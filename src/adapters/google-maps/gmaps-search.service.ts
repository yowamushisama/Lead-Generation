import { Injectable } from '@nestjs/common';
import type { Page } from 'playwright';
import { AppLogger } from '../../common/utils/logger.util';
import { PlaywrightStealthService } from '../shared/playwright-stealth.service';
import { GMAPS_SELECTORS } from './gmaps-selectors.config';
import { scrollPage } from '../shared/page-helpers';
import { GMAPS_PROFILE_KEY } from './gmaps-adapter.config';
import { gmapsListingKey } from './gmaps-listing-key';
import { placeIdFromUrl } from './gmaps-url-utils';

export type FastScrollMode =
  | 'NORMAL'             // probe not attempted (flag off, no cursor, or tailIds too small)
  | 'NORMAL_FROM_ANCHOR' // probe located the previous-run anchor exactly
  | 'NORMAL_FROM_TAIL'   // probe reached ≥TAIL_HIT_THRESHOLD overlap with tailIds
  | 'NORMAL_FRESH'       // feed reordered; probe bailed out (no usable seed)
  | 'NORMAL_FROM_PARTIAL'; // probe exhausted budget before hitting threshold

export interface FastScrollResult {
  mode: FastScrollMode;
  /** gmapsListingKey values already in cursor data — safe to seed scrollUntilStable's seenInSession. */
  knownDuplicateKeys: Set<string>;
  /** URLs observed by probe whose key was NOT in cursor data — must flow through normal extraction. */
  freshProbeUrls: string[];
  probeSeenCount: number;
  hitRate: number;
  reason: string;
  scrolls: number;
}

@Injectable()
export class GmapsSearchService {
  private readonly logger = new AppLogger(GmapsSearchService.name);

  constructor(private readonly stealthService: PlaywrightStealthService) {}

  async newPage(): Promise<Page> {
    return this.stealthService.newPage(GMAPS_PROFILE_KEY);
  }

  buildSearchUrl(searchTerm: string): string {
    return `https://www.google.com/maps/search/${encodeURIComponent(searchTerm)}/`;
  }

  async navigateToSearch(page: Page, searchTerm: string, organizationId: string): Promise<void> {
    const url = this.buildSearchUrl(searchTerm);

    const mouseX = Math.floor(Math.random() * 800) + 100;
    const mouseY = Math.floor(Math.random() * 400) + 100;

    try {
      await (page as any).mouse.move(mouseX, mouseY);
      await page.waitForTimeout(this.stealthService.randomDelayMs(600, 1500));
      await (page as any).goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

      await (page as any)
        .waitForSelector(GMAPS_SELECTORS.waitForFeed, { timeout: 15000 })
        .catch(() => {});

      this.logger.log({ message: 'Navigated to Google Maps search', module: 'gmaps', organizationId, url });
    } catch (error) {
      this.logger.error({
        message: 'GMaps navigation failed',
        module: 'gmaps',
        organizationId,
        url,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Scroll the left-rail feed to load more results.
   * Tries each feedContainer selector in order and scrolls whichever matches.
   * Falls back to page scroll if no container is found.
   */
  async scrollFeed(page: Page, steps = 8): Promise<void> {
    const containerSel = await this.findFeedContainer(page);

    await scrollPage(page, {
      container: containerSel,
      stepPx: 500,
      steps,
      minDelayMs: 700,
      maxDelayMs: 1500,
    });

    await page.waitForTimeout(this.stealthService.randomDelayMs(500, 1200));
  }

  /**
   * Adaptive scroll collector. Scrolls one step at a time, calling onBatch() with newly-seen
   * URLs after each scroll. Stops when onBatch returns { stop: true }, no new DOM URLs appear
   * for idleScrollsBeforeStop consecutive scrolls, or maxScrolls is reached.
   *
   * Returns the stop reason: 'END_OF_FEED' | 'MAX_SCROLLS' | 'CALLER_STOP'.
   *
   * @param opts.seedSeenInSession - gmapsListingKey values to pre-populate seenInSession with.
   *   Only pass KNOWN-DUPLICATE keys here (e.g. knownDuplicateKeys from fastScrollProbe).
   *   Never pass freshProbeUrls keys — those must flow through extraction.
   */
  async scrollUntilStable(
    page: Page,
    opts: {
      maxScrolls: number;
      idleScrollsBeforeStop: number;
      onBatch: (newUrls: string[]) => { stop: boolean; reason?: string } | Promise<{ stop: boolean; reason?: string }>;
      onScrollStep?: () => void;
      seedSeenInSession?: Set<string>;
    },
  ): Promise<string> {
    const containerSel = await this.findFeedContainer(page);

    // Seed with known-duplicate keys so they are excluded at URL-collection time,
    // saving per-batch DB lookups. All keys must be gmapsListingKey() values.
    const seenInSession = new Set<string>(opts.seedSeenInSession ?? []);
    let consecutiveIdle = 0;

    for (let step = 0; step < opts.maxScrolls; step++) {
      await scrollPage(page, {
        container: containerSel,
        stepPx: 600,
        steps: 1,
        minDelayMs: 700,
        maxDelayMs: 1500,
      });
      await page.waitForTimeout(this.stealthService.randomDelayMs(400, 900));

      if (opts.onScrollStep) opts.onScrollStep();

      const allUrls = await this.collectListingUrls(page);
      const newUrls = allUrls.filter((u) => !seenInSession.has(gmapsListingKey(u)));
      for (const u of newUrls) seenInSession.add(gmapsListingKey(u));

      if (newUrls.length === 0) {
        consecutiveIdle++;
        if (consecutiveIdle >= opts.idleScrollsBeforeStop) return 'END_OF_FEED';
        continue;
      }
      consecutiveIdle = 0;

      const result = await opts.onBatch(newUrls);
      if (result.stop) return result.reason ?? 'CALLER_STOP';
    }

    return 'MAX_SCROLLS';
  }

  /**
   * Collect URLs (or element handles) for all visible listing cards.
   * Returns hrefs pointing to individual place pages.
   */
  async collectListingUrls(page: Page): Promise<string[]> {
    const hrefs: string[] = await (page as any).evaluate((selectors: string[]) => {
      for (const sel of selectors) {
        try {
          const cards = Array.from(document.querySelectorAll(sel));
          if (cards.length > 0) {
            return cards
              .map((card) => {
                // Each card is usually a div wrapping an <a> that links to the place
                const a = card.tagName === 'A'
                  ? card as HTMLAnchorElement
                  : card.querySelector('a[href*="/maps/place/"]') as HTMLAnchorElement | null;
                return a?.href ?? '';
              })
              .filter(Boolean);
          }
        } catch { /* skip */ }
      }
      return [];
    }, GMAPS_SELECTORS.listingCards);

    // Deduplicate
    return [...new Set(hrefs)];
  }

  safeUrl(page: Page): string {
    try { return page.url(); } catch { return '<unavailable>'; }
  }

  /** Find the feed container selector that matches the current DOM. */
  async findFeedContainer(page: Page): Promise<string | undefined> {
    for (const sel of GMAPS_SELECTORS.feedContainer) {
      const el = await (page as any).$(sel).catch(() => null);
      if (el) return sel;
    }
    return undefined;
  }

  /**
   * Fast-scroll probe — cheaply scrolls past previously-scraped territory before extraction.
   *
   * Scrolls with minimal delay, classifying each observed URL against cursor data into:
   * - knownDuplicateKeys: safe to seed scrollUntilStable (already in cursor, no extraction needed)
   * - freshProbeUrls: NOT in cursor — must flow through full extraction pipeline
   *
   * Stops when anchor is hit, tail-hit threshold is reached, or budget is exhausted.
   * Returns NORMAL_FRESH (empty sets) if the feed looks shuffled — caller falls through cleanly.
   */
  async fastScrollProbe(
    page: Page,
    opts: {
      cursorTailIds: string[];
      cursorSeenIds: Set<string>;
      anchor: string | null;
      budget: number;
      maxMs: number;
      minTailForProbe?: number;
      tailHitThreshold?: number;
      minShuffleDetect?: number;
    },
  ): Promise<FastScrollResult> {
    const minTail = opts.minTailForProbe ?? 10;
    const threshold = opts.tailHitThreshold ?? 0.4;
    const shuffleDetect = opts.minShuffleDetect ?? 15;

    if (opts.cursorTailIds.length < minTail) {
      return {
        mode: 'NORMAL', knownDuplicateKeys: new Set(), freshProbeUrls: [],
        probeSeenCount: 0, hitRate: 0, reason: 'NO_PROBE', scrolls: 0,
      };
    }

    const tailSet = new Set(opts.cursorTailIds);
    const seenKeys = new Set<string>();
    const known = new Set<string>();
    const fresh: string[] = [];
    let hits = 0;
    let scrolls = 0;
    const deadline = Date.now() + opts.maxMs;

    const containerSel = await this.findFeedContainer(page);

    while (scrolls < opts.budget && Date.now() < deadline) {
      await scrollPage(page, {
        container: containerSel,
        stepPx: 900,
        steps: 1,
        minDelayMs: 250,
        maxDelayMs: 600,
      });
      scrolls++;

      const allUrls = await this.collectListingUrls(page);

      for (const url of allUrls) {
        const key = gmapsListingKey(url);
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);

        // Check both canonical and legacy key formats against cursorSeenIds to handle
        // existing rows written before gmapsListingKey was introduced.
        const legacyKey = placeIdFromUrl(url) ?? url;
        const inTail = tailSet.has(key);
        const inSeenId = opts.cursorSeenIds.has(key) || opts.cursorSeenIds.has(legacyKey);

        if (inTail || inSeenId) {
          known.add(key);
          if (inTail) hits++;
        } else {
          fresh.push(url);
        }

        if (opts.anchor && key === opts.anchor) {
          return {
            mode: 'NORMAL_FROM_ANCHOR', knownDuplicateKeys: known, freshProbeUrls: fresh,
            probeSeenCount: seenKeys.size, hitRate: hits / tailSet.size,
            reason: 'ANCHOR_HIT', scrolls,
          };
        }
      }

      const hitRate = hits / tailSet.size;
      if (hitRate >= threshold) {
        return {
          mode: 'NORMAL_FROM_TAIL', knownDuplicateKeys: known, freshProbeUrls: fresh,
          probeSeenCount: seenKeys.size, hitRate,
          reason: 'TAIL_THRESHOLD_MET', scrolls,
        };
      }

      // If the feed has been heavily reordered (no overlap after enough scrolls), bail out.
      // Return empty sets so scrollUntilStable runs from scratch — correctness preserved.
      if (scrolls >= shuffleDetect && hits === 0) {
        return {
          mode: 'NORMAL_FRESH', knownDuplicateKeys: new Set(), freshProbeUrls: [],
          probeSeenCount: seenKeys.size, hitRate: 0,
          reason: 'NO_OVERLAP_SHUFFLE', scrolls,
        };
      }
    }

    return {
      mode: 'NORMAL_FROM_PARTIAL', knownDuplicateKeys: known, freshProbeUrls: fresh,
      probeSeenCount: seenKeys.size, hitRate: hits / tailSet.size,
      reason: 'BUDGET_EXHAUSTED', scrolls,
    };
  }
}
