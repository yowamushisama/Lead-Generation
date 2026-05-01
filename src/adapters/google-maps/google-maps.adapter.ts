import { Injectable } from '@nestjs/common';
import { BaseAdapter } from '../base.adapter';
import { AdapterConfig } from '../../common/interfaces/adapter.interface';
import { RawLeadInput } from '../../common/interfaces/lead-input.interface';
import { LeadSource } from '../../common/enums/lead-source.enum';
import { GmapsSearchService } from './gmaps-search.service';
import { GmapsExtractionService, GmapsPlace } from './gmaps-extraction.service';
import { GmapsAdapterConfig, INTER_QUERY_DELAY_MS } from './gmaps-adapter.config';
import { retryWithBackoff, isRetryableError } from '../shared/retry.util';

@Injectable()
export class GoogleMapsAdapter extends BaseAdapter {
  readonly name = LeadSource.GOOGLE_MAPS;
  readonly sourceType = 'discovery' as const;

  constructor(
    private readonly searchService: GmapsSearchService,
    private readonly extractionService: GmapsExtractionService,
  ) {
    super();
  }

  async isHealthy(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      const res = await fetch('https://www.google.com/maps', {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible)' },
      });
      clearTimeout(timer);
      return res.status < 500;
    } catch {
      return false;
    }
  }

  async *collect(config: AdapterConfig): AsyncGenerator<RawLeadInput> {
    this.validateConfig(config);

    const gmapsConfig = config as GmapsAdapterConfig;
    const locations = gmapsConfig.locations ?? [];
    const industries = gmapsConfig.industries ?? [];
    const maxResults = gmapsConfig.maxResults ?? 100;
    const scrollSteps = gmapsConfig.scrollSteps ?? 8;
    const fetchDetails = gmapsConfig.fetchDetails !== false;

    if (locations.length === 0 || industries.length === 0) {
      this.logWarn('Google Maps adapter requires both locations and industries', {
        organizationId: config.organizationId,
      });
      return;
    }

    let yielded = 0;
    const seenUrls = new Set<string>();
    const page = await this.searchService.newPage();

    try {
      for (const industry of industries) {
        for (const location of locations) {
          if (yielded >= maxResults) break;

          if (yielded > 0) {
            await page.waitForTimeout(INTER_QUERY_DELAY_MS);
          }

          // Collect batch outside retryWithBackoff so generator yield works correctly
          let batch: RawLeadInput[] = [];

          try {
            await retryWithBackoff(
              async () => {
                await this.searchService.navigateToSearch(page, industry, location, config.organizationId);
                await this.searchService.scrollFeed(page, scrollSteps);

                if (fetchDetails) {
                  const urls = await this.searchService.collectListingUrls(page);
                  const newUrls = urls.filter((u) => u && !seenUrls.has(u));

                  for (const url of newUrls) {
                    if (batch.length + yielded >= maxResults) break;
                    seenUrls.add(url);

                    await page.waitForTimeout(800 + Math.floor(Math.random() * 1200));

                    const place = await this.extractionService.extractFromUrl(page, url);
                    if (!place || !place.name) continue;

                    batch.push(this.toRawLead(place, industry, config.campaignId, `${industry} in ${location}`));

                    // Navigate back to results for the next listing
                    await this.searchService.navigateToSearch(page, industry, location, config.organizationId);
                  }
                } else {
                  const tiles = await this.extractionService.extractTiles(page);

                  for (const tile of tiles) {
                    if (batch.length + yielded >= maxResults) break;
                    if (!tile.url || seenUrls.has(tile.url)) continue;
                    seenUrls.add(tile.url);

                    const placeIdMatch = tile.url.match(/place\/[^/]+\/([^/?]+)/);
                    const placeId = placeIdMatch ? placeIdMatch[1] : tile.url;

                    batch.push({
                      externalId: placeId,
                      source: LeadSource.GOOGLE_MAPS,
                      sourceType: 'discovery',
                      sourceUrl: tile.url,
                      name: tile.name,
                      company: tile.name,
                      industry,
                      metadata: {
                        rating: tile.rating,
                        reviewCount: tile.reviewCount,
                        placeId,
                        googleTypes: tile.category ? [tile.category] : [],
                        campaignId: config.campaignId,
                        searchQuery: `${industry} in ${location}`,
                        scrapedAt: new Date().toISOString(),
                      },
                    });
                  }
                }
              },
              { maxAttempts: 3, baseMs: 15_000, jitter: 0.3 },
            );
          } catch (err: unknown) {
            if (isRetryableError(err)) {
              this.logError(`GMaps scrape failed for "${industry} in ${location}"`, err);
            }
          }

          // Yield collected leads outside the closure (generator requirement)
          for (const lead of batch) {
            if (yielded >= maxResults) break;
            yield lead;
            yielded++;
          }

          this.log(`Query "${industry} in ${location}" yielded ${batch.length} leads`, {
            organizationId: config.organizationId,
          });
        }
      }
    } finally {
      await (page as any).close().catch(() => {});
      this.log(`Google Maps collect complete: ${yielded} leads`, {
        organizationId: config.organizationId,
      });
    }
  }

  private toRawLead(place: GmapsPlace, industry: string, campaignId?: string, searchQuery?: string): RawLeadInput {
    return {
      externalId: place.placeId ?? place.sourceUrl,
      source: LeadSource.GOOGLE_MAPS,
      sourceType: 'discovery',
      sourceUrl: place.sourceUrl,
      name: place.name,
      company: place.name,
      location: place.address ?? undefined,
      phone: place.phone ?? undefined,
      website: place.website ?? undefined,
      industry,
      metadata: {
        rating: place.rating,
        reviewCount: place.reviewCount,
        placeId: place.placeId,
        googleTypes: place.googleTypes,
        businessHours: place.businessHours,
        lastReviewAt: place.lastReviewAt,
        socialHandlesFromGmaps: place.socialHandles,
        campaignId,
        searchQuery: searchQuery ?? place.sourceUrl,
        scrapedAt: new Date().toISOString(),
      },
    };
  }
}
