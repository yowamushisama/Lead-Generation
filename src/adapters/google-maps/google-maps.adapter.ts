import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import { BaseAdapter } from '../base.adapter';
import { AdapterConfig } from '../../common/interfaces/adapter.interface';
import { RawLeadInput } from '../../common/interfaces/lead-input.interface';
import { LeadSource } from '../../common/enums/lead-source.enum';
import { GmapsSearchService } from './gmaps-search.service';
import { GmapsExtractionService, GmapsPlace } from './gmaps-extraction.service';
import { GmapsAdapterConfig, INTER_QUERY_DELAY_MS } from './gmaps-adapter.config';
import { retryWithBackoff, isRetryableError } from '../shared/retry.util';
import { LeadRepository } from '../../database/repositories/lead.repository';
import { CampaignScrapeCursorRepository } from '../../database/repositories/campaign-scrape-cursor.repository';

/** Extract the canonical ChIJ… placeId from a Google Maps listing URL (cheap, no page navigation). */
function placeIdFromUrl(url: string): string | null {
  const m = url.match(/!19s(ChIJ[A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

/** Stable query identifier for cursor tracking. */
function queryKey(keyword: string, industry: string, location: string): string {
  return createHash('sha256')
    .update(`${keyword}|${industry}|${location}`)
    .digest('hex')
    .slice(0, 16);
}

/** Clamp a value between min and max (inclusive). */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

@Injectable()
export class GoogleMapsAdapter extends BaseAdapter {
  readonly name = LeadSource.GOOGLE_MAPS;
  readonly sourceType = 'discovery' as const;

  constructor(
    private readonly searchService: GmapsSearchService,
    private readonly extractionService: GmapsExtractionService,
    private readonly leadRepository: LeadRepository,
    private readonly cursorRepository: CampaignScrapeCursorRepository,
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
    const rawKeywords = (gmapsConfig.keywords ?? []).filter(Boolean);
    const maxResults = gmapsConfig.maxResults ?? 100;
    const fetchDetails = gmapsConfig.fetchDetails !== false;
    const { organizationId, campaignId } = config;

    if (locations.length === 0 || industries.length === 0) {
      this.logWarn('Google Maps adapter requires both locations and industries', { organizationId });
      return;
    }

    // Build the full search term list: keywords × industries × locations.
    // If no keywords are configured, fall back to industries × locations.
    const terms: Array<{ keyword: string; industry: string; location: string; searchTerm: string }> = [];
    const keywordAxis = rawKeywords.length > 0 ? rawKeywords : [''];
    for (const keyword of keywordAxis) {
      for (const industry of industries) {
        for (const location of locations) {
          const parts = [keyword, industry].filter(Boolean);
          const searchTerm = `${parts.join(' ')} in ${location}`.replace(/\s+/g, ' ').trim();
          terms.push({ keyword, industry, location, searchTerm });
        }
      }
    }

    // Warm-load all placeIds + externalIds already persisted for this org to avoid re-ingesting.
    const existingRows = await this.leadRepository.findMany({
      where: { organizationId, source: LeadSource.GOOGLE_MAPS },
      select: { placeId: true, externalId: true },
    });
    const seenPlaceIds = new Set<string>(
      existingRows.flatMap((r) => [r.placeId, r.externalId].filter((v): v is string => Boolean(v))),
    );

    // Per-run in-memory URL seen-set (dedups within the same collect() call).
    const seenUrls = new Set<string>();

    let newLeadsYielded = 0;
    let firstQuery = true;
    const page = await this.searchService.newPage();

    try {
      for (const { keyword, industry, location, searchTerm } of terms) {
        if (newLeadsYielded >= maxResults) break;

        const qKey = queryKey(keyword, industry, location);

        // Read cursor to determine scroll depth and whether to skip exhausted queries.
        const cursor = campaignId ? await this.cursorRepository.findOne(campaignId, 'google_maps', qKey) : null;

        if (cursor?.exhausted) {
          this.log(`Skipping exhausted query "${searchTerm}"`, { organizationId });
          continue;
        }

        // Adaptive scroll depth: grow by 50% per zero-new run, capped at 30 steps.
        const baseSteps = gmapsConfig.scrollSteps ?? cursor?.lastScrollSteps ?? 8;
        const consecutiveZero = cursor?.consecutiveZeroRuns ?? 0;
        const scrollSteps = clamp(Math.round(baseSteps * Math.pow(1.5, consecutiveZero)), 8, 30);

        if (!firstQuery) {
          await page.waitForTimeout(INTER_QUERY_DELAY_MS);
        }
        firstQuery = false;

        let batch: RawLeadInput[] = [];
        let urlsScannedThisQuery = 0;
        let scrapeSucceeded = false;

        try {
          await retryWithBackoff(
            async () => {
              // Attempt-local state: mutations stay here until the attempt fully
              // succeeds, then merge into outer sets. This ensures a mid-loop
              // extractFromUrl() throw leaves outer state pristine so the retry
              // can re-process every URL from scratch.
              const attemptBatch: RawLeadInput[] = [];
              const attemptSeenUrls = new Set<string>();
              const attemptSeenPlaceIds = new Set<string>();

              await this.searchService.navigateToSearch(page, searchTerm, organizationId);
              await this.searchService.scrollFeed(page, scrollSteps);

              if (fetchDetails) {
                const urls = await this.searchService.collectListingUrls(page);
                urlsScannedThisQuery = urls.length;

                const freshUrls = urls.filter((u) => {
                  if (!u || seenUrls.has(u)) return false;
                  // Pre-flight placeId skip: cheap URL regex, no page navigation needed.
                  const pid = placeIdFromUrl(u);
                  return !pid || !seenPlaceIds.has(pid);
                });

                for (const url of freshUrls) {
                  if (attemptBatch.length + batch.length + newLeadsYielded >= maxResults) break;
                  attemptSeenUrls.add(url);

                  await page.waitForTimeout(800 + Math.floor(Math.random() * 1200));

                  const place = await this.extractionService.extractFromUrl(page, url);
                  if (!place || !place.name || place.name === 'Unknown Business') continue;

                  const placeId = place.placeId;
                  if (placeId && (seenPlaceIds.has(placeId) || attemptSeenPlaceIds.has(placeId))) continue;

                  attemptBatch.push(this.toRawLead(place, industry, campaignId, searchTerm));
                  if (placeId) attemptSeenPlaceIds.add(placeId);

                  // Navigate back to results for the next listing.
                  await this.searchService.navigateToSearch(page, searchTerm, organizationId);
                }
              } else {
                const tiles = await this.extractionService.extractTiles(page);
                urlsScannedThisQuery = tiles.length;

                for (const tile of tiles) {
                  if (attemptBatch.length + batch.length + newLeadsYielded >= maxResults) break;
                  if (!tile.url || seenUrls.has(tile.url)) continue;

                  const pid = placeIdFromUrl(tile.url);
                  if (pid && (seenPlaceIds.has(pid) || attemptSeenPlaceIds.has(pid))) continue;

                  attemptSeenUrls.add(tile.url);
                  const placeId = pid ?? tile.url;

                  attemptBatch.push({
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
                      placeId: pid,
                      googleTypes: tile.category ? [tile.category] : [],
                      campaignId,
                      searchQuery: searchTerm,
                      scrapedAt: new Date().toISOString(),
                    },
                  });

                  if (pid) attemptSeenPlaceIds.add(pid);
                }
              }

              // Merge into outer state only after the attempt completes without throwing.
              for (const u of attemptSeenUrls) seenUrls.add(u);
              for (const p of attemptSeenPlaceIds) seenPlaceIds.add(p);
              batch.push(...attemptBatch);
            },
            { maxAttempts: 3, baseMs: 15_000, jitter: 0.3 },
          );
          scrapeSucceeded = true;
        } catch (err: unknown) {
          if (isRetryableError(err)) {
            this.logError(`GMaps scrape failed for "${searchTerm}"`, err);
          }
        }

        const newCountThisQuery = batch.length;

        // Yield collected leads outside the closure (generator requirement).
        for (const lead of batch) {
          if (newLeadsYielded >= maxResults) break;
          yield lead;
          newLeadsYielded++;
        }

        this.log(`Query "${searchTerm}" yielded ${newCountThisQuery} new leads (scrollSteps=${scrollSteps})`, {
          organizationId,
        });

        // Only update the cursor on success — transient scrape failures must not
        // increment consecutiveZeroRuns or prematurely mark a query exhausted.
        if (campaignId && scrapeSucceeded) {
          const newConsecutiveZero = newCountThisQuery === 0 ? consecutiveZero + 1 : 0;
          await this.cursorRepository.upsert(campaignId, 'google_maps', qKey, {
            lastRunAt: new Date(),
            lastScrollSteps: scrollSteps,
            totalSeenDelta: urlsScannedThisQuery,
            lastNewCount: newCountThisQuery,
            consecutiveZeroRuns: newConsecutiveZero,
            lastNewLeadAt: newCountThisQuery > 0 ? new Date() : (cursor?.lastNewLeadAt ?? null),
            exhausted: newConsecutiveZero >= 3,
          });
        }
      }
    } finally {
      await (page as any).close().catch(() => {});
      this.log(`Google Maps collect complete: ${newLeadsYielded} new leads`, { organizationId });
    }
  }

  private toRawLead(place: GmapsPlace, industry: string, campaignId?: string, searchQuery?: string): RawLeadInput {
    return {
      externalId: place.placeId ?? place.sourceUrl,
      source: LeadSource.GOOGLE_MAPS,
      sourceType: 'discovery',
      sourceUrl: place.sourceUrl,
      name: place.name ?? '',
      company: place.name ?? undefined,
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
