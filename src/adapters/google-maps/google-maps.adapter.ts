import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import { BaseAdapter } from '../base.adapter';
import { AdapterConfig } from '../../common/interfaces/adapter.interface';
import { RawLeadInput } from '../../common/interfaces/lead-input.interface';
import { LeadSource } from '../../common/enums/lead-source.enum';
import { GmapsSearchService } from './gmaps-search.service';
import { GmapsExtractionService, GmapsPlace } from './gmaps-extraction.service';
import {
  GmapsAdapterConfig,
  INTER_QUERY_DELAY_MS,
  DUPLICATE_WALL_THRESHOLD,
  NO_NEW_LISTINGS_THRESHOLD,
  MAX_SCROLL_BUDGET_PER_QUERY,
  MAX_SCROLL_PHASE_MS,
  MAX_EXTRACT_PHASE_MS,
  MAX_EXTRACTIONS_PER_QUERY,
} from './gmaps-adapter.config';
import { retryWithBackoff, isRetryableError } from '../shared/retry.util';
import { LeadRepository } from '../../database/repositories/lead.repository';
import { CampaignScrapeCursorRepository } from '../../database/repositories/campaign-scrape-cursor.repository';

/**
 * Extract a stable place identifier from a Google Maps URL without navigating to it.
 *
 * Google Maps uses two ID formats depending on the URL type:
 *   - Listing card URLs (search results feed): !1s0xHEX:0xHEX  (hex-encoded lat/lng pair)
 *   - Detail page URLs (after navigation):     !19sChIJxxxxxxx  (base64/ChIJ canonical ID)
 *
 * We try ChIJ first, then fall back to the hex format always present on listing card hrefs.
 * Returning null means neither is in the URL; the caller falls back to the full URL string.
 */
function placeIdFromUrl(url: string): string | null {
  const chij = url.match(/!19s(ChIJ[A-Za-z0-9_-]+)/);
  if (chij) return chij[1];
  // Hex format present on listing cards: !1s0x<hex>%3A0x<hex> or !1s0x<hex>:0x<hex>
  const hex = url.match(/!1s(0x[0-9a-f]+(?:%3A|:)0x[0-9a-f]+)/i);
  if (hex) return hex[1].toLowerCase().replace('%3a', ':');
  return null;
}

/** Strip query-string from a Google Maps URL, keeping the stable data= path segment. */
function normalizeGmapsUrl(url: string): string {
  return url.split('?')[0];
}

/** Stable query identifier for cursor tracking. */
function queryKey(keyword: string, industry: string, location: string): string {
  return createHash('sha256')
    .update(`${keyword}|${industry}|${location}`)
    .digest('hex')
    .slice(0, 16);
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
    const fetchDetails = gmapsConfig.fetchDetails !== false;
    const ignoreExhausted = gmapsConfig.ignoreExhausted === true;
    const statsCollector = gmapsConfig.statsCollector;
    const cancellationSignal = gmapsConfig.cancellationSignal ?? { reason: null };
    const maxExtractionsPerQuery = gmapsConfig.maxExtractionsPerQuery ?? MAX_EXTRACTIONS_PER_QUERY;
    const maxScrollBudgetPerQuery = gmapsConfig.maxScrollBudgetPerQuery ?? MAX_SCROLL_BUDGET_PER_QUERY;
    const maxScrollPhaseMs = gmapsConfig.maxScrollPhaseMs ?? MAX_SCROLL_PHASE_MS;
    const maxExtractPhaseMs = gmapsConfig.maxExtractPhaseMs ?? MAX_EXTRACT_PHASE_MS;
    const { organizationId, campaignId } = config;

    if (locations.length === 0 || industries.length === 0) {
      this.logWarn('Google Maps adapter requires both locations and industries', { organizationId });
      return;
    }

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

    let firstQuery = true;
    const page = await this.searchService.newPage();

    try {
      for (const { keyword, industry, location, searchTerm } of terms) {
        const qKey = queryKey(keyword, industry, location);

        const cursor = campaignId ? await this.cursorRepository.findOne(campaignId, 'google_maps', qKey) : null;

        if (cursor?.exhausted && !ignoreExhausted) {
          this.log(`Skipping exhausted query "${searchTerm}"`, { organizationId });
          continue;
        }
        if (cursor?.exhausted && ignoreExhausted) {
          this.log(`Retrying exhausted query "${searchTerm}" because ignoreExhausted=true`, { organizationId });
        }

        if (!firstQuery) {
          await page.waitForTimeout(INTER_QUERY_DELAY_MS);
        }
        firstQuery = false;

        const cursorSeenIds = new Set<string>(cursor?.seenExternalIds ?? []);

        let logId: string | undefined;
        const queryStartedAt = Date.now();
        let scrapeSucceeded = false;
        let queryEndReason = 'ERROR';
        let queryErrorSummary: string | undefined;
        let scrollAttempts = 0;

        const seenAccumulator: string[] = [];
        const batchYielded: RawLeadInput[] = [];

        // Per-query scope: finally fires whether yields complete normally or runner cancels.
        // This ensures both the log row and cursor are always finalized.
        try {
          if (statsCollector) {
            logId = await statsCollector.beginQuery({
              queryKey: qKey,
              searchTerm,
              campaignId: campaignId ?? '',
              organizationId,
            });
          }

          try {
            await retryWithBackoff(
              async () => {
                batchYielded.length = 0;
                seenAccumulator.length = 0;
                scrollAttempts = 0;

                await this.searchService.navigateToSearch(page, searchTerm, organizationId);

                if (fetchDetails) {
                  // ── Phase 1: Adaptive scroll with inline DB dedup per batch ─────
                  // Detects duplicate walls against BOTH cursor cache and DB, so scroll
                  // stops early even when cursor cache hasn't warmed up yet.
                  const collectedUrls: string[] = [];
                  let consecutiveDuplicateBatches = 0;

                  const scrollStopReason = await this.searchService.scrollUntilStable(page, {
                    maxScrolls: maxScrollBudgetPerQuery,
                    idleScrollsBeforeStop: NO_NEW_LISTINGS_THRESHOLD,
                    onScrollStep: () => {
                      scrollAttempts++;
                      if (logId && statsCollector) statsCollector.recordScrollAttempt(logId);
                    },
                    onBatch: async (newUrls) => {
                      if (Date.now() - queryStartedAt > maxScrollPhaseMs) {
                        return { stop: true, reason: 'QUERY_TIMEOUT' };
                      }

                      // Classify each URL against cursor cache first (no DB cost).
                      const notInCursor: string[] = [];
                      let batchCursorHits = 0;
                      for (const url of newUrls) {
                        const pid = placeIdFromUrl(url);
                        const id = pid ?? url;
                        if (cursorSeenIds.has(id)) {
                          batchCursorHits++;
                        } else {
                          notInCursor.push(url);
                        }
                      }
                      if (logId && statsCollector && batchCursorHits > 0) {
                        statsCollector.recordCursorHit(logId, batchCursorHits);
                      }

                      // Batch DB check for URLs that passed cursor.
                      // batchIds: hex or ChIJ place ID if extractable, else raw URL.
                      // normalizedUrls: query-string stripped listing card URLs matched against
                      // stored sourceUrl — catches existing leads where placeIdFromUrl returns null
                      // because the listing card uses hex format but externalId stored ChIJ.
                      const batchIds = notInCursor.map((url) => placeIdFromUrl(url) ?? url);
                      const normalizedUrls = notInCursor.map(normalizeGmapsUrl);
                      let dbKnownIds = new Set<string>();
                      if (batchIds.length > 0) {
                        const matches = await this.leadRepository.findMany({
                          where: {
                            organizationId,
                            source: LeadSource.GOOGLE_MAPS,
                            OR: [
                              { externalId: { in: batchIds } },
                              { placeId: { in: batchIds } },
                              { sourceUrl: { in: normalizedUrls } },
                            ],
                          },
                          select: { externalId: true, placeId: true, sourceUrl: true },
                        });
                        dbKnownIds = new Set<string>(
                          matches.flatMap((m: { externalId: string | null; placeId: string | null; sourceUrl: string | null }) =>
                            [m.externalId, m.placeId, m.sourceUrl ? normalizeGmapsUrl(m.sourceUrl) : null]
                              .filter((v): v is string => Boolean(v)),
                          ),
                        );
                      }

                      let freshCount = 0;
                      let dbDups = 0;
                      for (const url of notInCursor) {
                        const pid = placeIdFromUrl(url);
                        const id = pid ?? url;
                        const isKnown = dbKnownIds.has(id) || dbKnownIds.has(normalizeGmapsUrl(url));
                        if (isKnown) {
                          dbDups++;
                          seenAccumulator.push(id);
                        } else {
                          collectedUrls.push(url);
                          freshCount++;
                        }
                      }
                      if (logId && statsCollector && dbDups > 0) {
                        statsCollector.recordDbBatchDuplicate(logId, dbDups);
                      }

                      // All URLs in this scroll batch were duplicates → potential wall.
                      const allDups = batchCursorHits + dbDups === newUrls.length && newUrls.length > 0;
                      consecutiveDuplicateBatches = allDups ? consecutiveDuplicateBatches + 1 : 0;
                      if (consecutiveDuplicateBatches >= DUPLICATE_WALL_THRESHOLD) {
                        return { stop: true, reason: 'DUPLICATE_WALL' };
                      }
                      // Continue if no fresh URLs (idle scrolls tracked by scrollUntilStable)
                      if (freshCount === 0 && !allDups) {
                        // notInCursor is empty but not because of duplicates — just no new DOM cards
                        return { stop: false };
                      }
                      return { stop: false };
                    },
                  });

                  queryEndReason = scrollStopReason === 'END_OF_FEED' ? 'END_OF_FEED'
                    : scrollStopReason === 'QUERY_TIMEOUT' ? 'QUERY_TIMEOUT'
                    : scrollStopReason === 'DUPLICATE_WALL' ? 'DUPLICATE_WALL'
                    : 'END_OF_FEED';

                  if (logId && statsCollector) {
                    statsCollector.recordCandidateUrlsCollected(logId, collectedUrls.length);
                  }

                  // ── Phase 2: Extraction (collectedUrls already deduped against cursor + DB) ──
                  let extractionsThisQuery = 0;
                  const attemptSeenIds = new Set<string>();
                  const extractionStartedAt = Date.now();

                  for (const url of collectedUrls) {
                    if (extractionsThisQuery >= maxExtractionsPerQuery) {
                      if (queryEndReason === 'END_OF_FEED') queryEndReason = 'EXTRACTION_BUDGET';
                      break;
                    }
                    if (Date.now() - extractionStartedAt > maxExtractPhaseMs) {
                      queryEndReason = 'QUERY_TIMEOUT';
                      break;
                    }

                    const pid = placeIdFromUrl(url);
                    const dedupeId = pid ?? url;

                    if (attemptSeenIds.has(dedupeId)) continue;

                    await page.waitForTimeout(800 + Math.floor(Math.random() * 1200));

                    const place = await this.extractionService.extractFromUrl(page, url);
                    extractionsThisQuery++;

                    if (!place || !place.name || place.name === 'Unknown Business') {
                      if (logId && statsCollector) statsCollector.recordExtractionFailure(logId, 1);
                      continue;
                    }

                    if (pid) attemptSeenIds.add(pid);
                    seenAccumulator.push(dedupeId);

                    const lead = this.toRawLead(place, industry, campaignId, searchTerm, logId);
                    batchYielded.push(lead);

                    if (logId && statsCollector) statsCollector.recordCandidateExtracted(logId);
                  }
                } else {
                  // Tile mode (no detail navigation)
                  const tiles = await this.extractionService.extractTiles(page);
                  scrollAttempts = 1;

                  // Batch IDs: placeId if available, else URL as fallback.
                  const batchIds = tiles
                    .filter((t) => Boolean(t.url))
                    .map((t) => placeIdFromUrl(t.url!) ?? t.url!);

                  let knownIds = new Set<string>();
                  if (batchIds.length > 0) {
                    const matches = await this.leadRepository.findMany({
                      where: {
                        organizationId,
                        source: LeadSource.GOOGLE_MAPS,
                        OR: [
                          { externalId: { in: batchIds } },
                          { placeId: { in: batchIds } },
                        ],
                      },
                      select: { externalId: true, placeId: true },
                    });
                    knownIds = new Set<string>(
                      matches.flatMap((m: { externalId: string | null; placeId: string | null }) =>
                        [m.externalId, m.placeId].filter((v): v is string => Boolean(v)),
                      ),
                    );
                  }

                  for (const tile of tiles) {
                    if (!tile.url) continue;
                    const pid = placeIdFromUrl(tile.url);
                    const dedupeId = pid ?? tile.url;

                    if (cursorSeenIds.has(dedupeId)) {
                      if (logId && statsCollector) statsCollector.recordCursorHit(logId, 1);
                      continue;
                    }
                    if (knownIds.has(dedupeId)) {
                      if (logId && statsCollector) statsCollector.recordDbBatchDuplicate(logId, 1);
                      seenAccumulator.push(dedupeId);
                      continue;
                    }

                    seenAccumulator.push(dedupeId);
                    batchYielded.push({
                      externalId: dedupeId,
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
                        queryKey: qKey,
                        gmapsLogId: logId,
                        scrapedAt: new Date().toISOString(),
                      },
                    });

                    if (logId && statsCollector) statsCollector.recordCandidateExtracted(logId);
                  }
                  queryEndReason = 'END_OF_FEED';
                }
              },
              { maxAttempts: 3, baseMs: 15_000, jitter: 0.3 },
            );
            scrapeSucceeded = true;
          } catch (err: unknown) {
            if (isRetryableError(err)) {
              this.logError(`GMaps scrape failed for "${searchTerm}"`, err);
            }
            queryErrorSummary = err instanceof Error ? err.message : String(err);
            queryEndReason = 'RETRY_EXHAUSTED';
          }

          // Yield loop is inside the per-query try scope so that:
          // 1. If runner breaks (cancellation), the finally below fires with the right reason.
          // 2. Cursor updates are skipped on cancellation (correct — don't mark query as processed).
          const newCountThisQuery = batchYielded.length;
          for (const lead of batchYielded) {
            yield lead;
          }

          this.log(
            `Query "${searchTerm}" yielded ${newCountThisQuery} new leads (scrolls=${scrollAttempts}, endReason=${queryEndReason})`,
            { organizationId },
          );

          if (campaignId && scrapeSucceeded) {
            const consecutiveZero = cursor?.consecutiveZeroRuns ?? 0;
            const newConsecutiveZero = newCountThisQuery === 0 ? consecutiveZero + 1 : 0;
            const isDuplicateWall = queryEndReason === 'DUPLICATE_WALL';
            const prevWallHits = cursor?.duplicateWallHits ?? 0;

            await this.cursorRepository.upsert(campaignId, 'google_maps', qKey, {
              lastRunAt: new Date(),
              lastScrollSteps: scrollAttempts,
              totalSeenDelta: seenAccumulator.length,
              lastNewCount: newCountThisQuery,
              consecutiveZeroRuns: newConsecutiveZero,
              lastNewLeadAt: newCountThisQuery > 0 ? new Date() : (cursor?.lastNewLeadAt ?? null),
              exhausted: newConsecutiveZero >= 3 && (prevWallHits + (isDuplicateWall ? 1 : 0)) >= 2,
              lastScrollDepth: scrollAttempts,
              duplicateWallHits: isDuplicateWall ? 1 : 0,
            });

            if (seenAccumulator.length > 0) {
              await this.cursorRepository.appendSeen(campaignId, 'google_maps', qKey, seenAccumulator);
            }
          }
        } finally {
          // Fires whether yields completed normally or runner cancelled mid-yield.
          // cancellationSignal.reason is set by the runner BEFORE breaking, so it's
          // available here when the generator unwinds.
          if (logId && statsCollector) {
            const finalReason = cancellationSignal.reason ?? queryEndReason;
            await statsCollector.finishQuery(logId, finalReason, queryErrorSummary);
          }
        }
      }
    } finally {
      await (page as any).close().catch(() => {});
      this.log('Google Maps collect complete', { organizationId });
    }
  }

  private toRawLead(
    place: GmapsPlace,
    industry: string,
    campaignId?: string,
    searchQuery?: string,
    gmapsLogId?: string,
  ): RawLeadInput {
    // Prefer ChIJ (from detail page URL), then hex ID (from listing card URL), then normalized URL.
    // Storing the hex ID ensures future listing-stage dedup can match without navigating.
    const normalizedSourceUrl = place.sourceUrl ? normalizeGmapsUrl(place.sourceUrl) : place.sourceUrl;
    const hexId = place.sourceUrl ? placeIdFromUrl(place.sourceUrl) : null;
    const externalId = place.placeId ?? hexId ?? normalizedSourceUrl;

    return {
      externalId,
      source: LeadSource.GOOGLE_MAPS,
      sourceType: 'discovery',
      sourceUrl: normalizedSourceUrl,
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
        gmapsLogId,
        scrapedAt: new Date().toISOString(),
      },
    };
  }
}
