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
  FAST_SCROLL_BUDGET,
  TAIL_HIT_THRESHOLD,
  MIN_TAIL_FOR_PROBE,
  MIN_SHUFFLE_DETECT,
  MAX_FAST_SCROLL_PHASE_MS,
} from './gmaps-adapter.config';
import { FastScrollResult } from './gmaps-search.service';
import { retryWithBackoff, isRetryableError } from '../shared/retry.util';
import { LeadRepository } from '../../database/repositories/lead.repository';
import { CampaignScrapeCursorRepository } from '../../database/repositories/campaign-scrape-cursor.repository';
import { placeIdFromUrl, normalizeGmapsUrl } from './gmaps-url-utils';
import { gmapsListingKey } from './gmaps-listing-key';
import { queryKey } from './gmaps-query-key';

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
    const fastScrollEnabled =
      process.env['GMAPS_FASTSCROLL_ENABLED'] === 'true' ||
      gmapsConfig.fastScrollEnabled === true;
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

        // findActive excludes archived cursors; manual ignoreExhausted runs also resurface archived ones
        const cursor = campaignId
          ? ignoreExhausted
            ? await this.cursorRepository.findOne(campaignId, 'google_maps', qKey, { includeArchived: true })
            : await this.cursorRepository.findActive(campaignId, 'google_maps', qKey)
          : null;

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
        // recentObservedIds tracks every listing key seen in the DOM this run (before any dedup).
        // Used to build the tail anchor for the fast-scroll probe in subsequent runs.
        const recentObservedIds: string[] = [];
        const batchYielded: RawLeadInput[] = [];
        // lastExtractedDedupeId: listing-card URL key (gmapsListingKey) of the last successfully
        // extracted lead. Stored as anchorPlaceId so the Phase 2 probe can seek this exact key,
        // which is guaranteed to be consistent with tailIds (both derived from listing-card URLs).
        let lastExtractedDedupeId: string | null = null;

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

          // Fast-scroll probe: runs once per query (not per retry) before retryWithBackoff.
          // Navigation happens here if the probe runs; retryWithBackoff skips it on first attempt.
          let probeResult: FastScrollResult = {
            mode: 'NORMAL', knownDuplicateKeys: new Set(), freshProbeUrls: [],
            probeSeenCount: 0, hitRate: 0, reason: 'DISABLED', scrolls: 0,
          };
          let probeNavigated = false;

          if (cursor && fastScrollEnabled && !ignoreExhausted && fetchDetails) {
            await this.searchService.navigateToSearch(page, searchTerm, organizationId);
            probeNavigated = true;
            probeResult = await this.searchService.fastScrollProbe(page, {
              cursorTailIds: (cursor as any).tailIds ?? [],
              cursorSeenIds,
              anchor: (cursor as any).anchorPlaceId ?? null,
              budget: FAST_SCROLL_BUDGET,
              maxMs: MAX_FAST_SCROLL_PHASE_MS,
              minTailForProbe: MIN_TAIL_FOR_PROBE,
              tailHitThreshold: TAIL_HIT_THRESHOLD,
              minShuffleDetect: MIN_SHUFFLE_DETECT,
            });
            this.log(
              `fastScrollProbe: mode=${probeResult.mode} reason=${probeResult.reason} scrolls=${probeResult.scrolls} hitRate=${probeResult.hitRate.toFixed(2)} fresh=${probeResult.freshProbeUrls.length} known=${probeResult.knownDuplicateKeys.size}`,
              { organizationId },
            );
            if (logId && statsCollector) {
              statsCollector.recordProbeResult(logId, {
                mode: probeResult.mode,
                scrolls: probeResult.scrolls,
                hitRate: probeResult.hitRate,
                reason: probeResult.reason,
                freshProbeUrlCount: probeResult.freshProbeUrls.length,
                knownDupCount: probeResult.knownDuplicateKeys.size,
                probeSeenCount: probeResult.probeSeenCount,
              });
            }
          }

          try {
            await retryWithBackoff(
              async () => {
                // Only skip re-navigation when the probe left the page at a useful position.
                // NORMAL_FRESH means the feed was shuffled — the probe position is unreliable,
                // so we must navigate fresh even on the first attempt after a NORMAL_FRESH probe.
                // Retries always re-navigate regardless.
                const usableProbePosition =
                  probeResult.mode === 'NORMAL_FROM_ANCHOR' ||
                  probeResult.mode === 'NORMAL_FROM_TAIL' ||
                  probeResult.mode === 'NORMAL_FROM_PARTIAL';
                const skipNav = probeNavigated && usableProbePosition;
                probeNavigated = false;

                batchYielded.length = 0;
                seenAccumulator.length = 0;
                scrollAttempts = 0;
                lastExtractedDedupeId = null;

                if (!skipNav) {
                  await this.searchService.navigateToSearch(page, searchTerm, organizationId);
                }

                if (fetchDetails) {
                  // ── Pre-scroll: process freshProbeUrls from probe (if any) ──────
                  // These are URLs the probe observed that weren't in cursor data.
                  // Run them through DB dedup before the main scroll to avoid re-extraction.
                  const collectedUrls: string[] = [];

                  if (probeResult.freshProbeUrls.length > 0) {
                    const freshKeys = probeResult.freshProbeUrls.map(gmapsListingKey);
                    const freshNormUrls = probeResult.freshProbeUrls.map(normalizeGmapsUrl);
                    const freshMatches = await this.leadRepository.findMany({
                      where: {
                        organizationId,
                        source: LeadSource.GOOGLE_MAPS,
                        OR: [
                          { externalId: { in: freshKeys } },
                          { placeId: { in: freshKeys } },
                          { sourceUrl: { in: freshNormUrls } },
                        ],
                      },
                      select: { externalId: true, placeId: true, sourceUrl: true },
                    });
                    const freshKnownIds = new Set<string>(
                      freshMatches.flatMap((m: { externalId: string | null; placeId: string | null; sourceUrl: string | null }) =>
                        [m.externalId, m.placeId, m.sourceUrl ? normalizeGmapsUrl(m.sourceUrl) : null]
                          .filter((v): v is string => Boolean(v)),
                      ),
                    );
                    for (const url of probeResult.freshProbeUrls) {
                      const key = gmapsListingKey(url);
                      if (freshKnownIds.has(key) || freshKnownIds.has(normalizeGmapsUrl(url))) {
                        seenAccumulator.push(key);
                        if (logId && statsCollector) statsCollector.recordDbBatchDuplicate(logId, 1);
                      } else {
                        collectedUrls.push(url);
                      }
                    }
                  }

                  // ── Phase 1: Adaptive scroll with inline DB dedup per batch ─────
                  // Detects duplicate walls against BOTH cursor cache and DB, so scroll
                  // stops early even when cursor cache hasn't warmed up yet.
                  // Seed seenInSession with known-duplicate keys from the probe so the scroll
                  // skips those at URL-collection time, saving per-batch DB lookups.
                  // Also seed with freshProbeUrls keys to avoid re-yielding them via onBatch.
                  const probeSeed = new Set(probeResult.knownDuplicateKeys);
                  for (const url of probeResult.freshProbeUrls) probeSeed.add(gmapsListingKey(url));

                  let consecutiveDuplicateBatches = 0;

                  const scrollStopReason = await this.searchService.scrollUntilStable(page, {
                    maxScrolls: maxScrollBudgetPerQuery,
                    idleScrollsBeforeStop: NO_NEW_LISTINGS_THRESHOLD,
                    seedSeenInSession: probeSeed,
                    onScrollStep: () => {
                      scrollAttempts++;
                      if (logId && statsCollector) statsCollector.recordScrollAttempt(logId);
                    },
                    onBatch: async (newUrls) => {
                      // Track ALL observed listing keys for the tail anchor (before any dedup).
                      for (const url of newUrls) recentObservedIds.push(gmapsListingKey(url));

                      if (Date.now() - queryStartedAt > maxScrollPhaseMs) {
                        return { stop: true, reason: 'QUERY_TIMEOUT' };
                      }

                      // Classify each URL against cursor cache first (no DB cost).
                      // Check both canonical key AND legacy raw key to handle existing rows
                      // that were written before gmapsListingKey was introduced.
                      const notInCursor: string[] = [];
                      let batchCursorHits = 0;
                      for (const url of newUrls) {
                        const id = gmapsListingKey(url);
                        const legacyId = placeIdFromUrl(url) ?? url;
                        if (cursorSeenIds.has(id) || cursorSeenIds.has(legacyId)) {
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
                      const batchIds = notInCursor.map(gmapsListingKey);
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
                        const id = gmapsListingKey(url);
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

                    const dedupeId = gmapsListingKey(url);

                    if (attemptSeenIds.has(dedupeId)) continue;

                    await page.waitForTimeout(800 + Math.floor(Math.random() * 1200));

                    const place = await this.extractionService.extractFromUrl(page, url);
                    extractionsThisQuery++;

                    if (!place || !place.name || place.name === 'Unknown Business') {
                      if (logId && statsCollector) statsCollector.recordExtractionFailure(logId, 1);
                      continue;
                    }

                    attemptSeenIds.add(dedupeId);
                    seenAccumulator.push(dedupeId);
                    lastExtractedDedupeId = dedupeId;

                    const lead = this.toRawLead(place, industry, campaignId, searchTerm, logId);
                    batchYielded.push(lead);

                    if (logId && statsCollector) statsCollector.recordCandidateExtracted(logId);
                  }
                } else {
                  // Tile mode (no detail navigation)
                  const tiles = await this.extractionService.extractTiles(page);
                  scrollAttempts = 1;

                  // Use gmapsListingKey for batchIds so the dedup comparison at tile-loop
                  // time (which also uses gmapsListingKey) is consistent. Also check sourceUrl
                  // to catch leads where placeIdFromUrl returned null and the raw URL was stored.
                  const urlTiles = tiles.filter((t) => Boolean(t.url));
                  const batchIds = urlTiles.map((t) => gmapsListingKey(t.url!));
                  const normalizedTileUrls = urlTiles.map((t) => normalizeGmapsUrl(t.url!));

                  let knownIds = new Set<string>();
                  if (batchIds.length > 0) {
                    const matches = await this.leadRepository.findMany({
                      where: {
                        organizationId,
                        source: LeadSource.GOOGLE_MAPS,
                        OR: [
                          { externalId: { in: batchIds } },
                          { placeId: { in: batchIds } },
                          { sourceUrl: { in: normalizedTileUrls } },
                        ],
                      },
                      select: { externalId: true, placeId: true, sourceUrl: true },
                    });
                    knownIds = new Set<string>(
                      matches.flatMap((m: { externalId: string | null; placeId: string | null; sourceUrl: string | null }) =>
                        [m.externalId, m.placeId, m.sourceUrl ? normalizeGmapsUrl(m.sourceUrl) : null]
                          .filter((v): v is string => Boolean(v)),
                      ),
                    );
                  }

                  for (const tile of tiles) {
                    if (!tile.url) continue;
                    const dedupeId = gmapsListingKey(tile.url);
                    const legacyId = placeIdFromUrl(tile.url) ?? tile.url;

                    if (cursorSeenIds.has(dedupeId) || cursorSeenIds.has(legacyId)) {
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
                        placeId: placeIdFromUrl(tile.url),
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

            // Write tail anchor: last 80 DOM-observed keys (all URLs seen before dedup).
            if (recentObservedIds.length > 0) {
              await this.cursorRepository.appendTail(campaignId, 'google_maps', qKey, recentObservedIds);
            }

            // anchorPlaceId must be a listing-card URL key (gmapsListingKey), NOT the ChIJ
            // externalId from the detail page, so it stays consistent with tailIds entries.
            const anchorPlaceId = lastExtractedDedupeId ?? cursor?.anchorPlaceId ?? null;
            await this.cursorRepository.updateAnchor(campaignId, 'google_maps', qKey, {
              anchorPlaceId,
              keyword,
              industry,
              location,
              lastEndReason: queryEndReason,
              fastScrollLastUsed: probeResult.scrolls,
              fastScrollBudgetDelta: probeResult.scrolls,
              fastScrollHitRate: probeResult.scrolls > 0 ? probeResult.hitRate : undefined,
            });
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
