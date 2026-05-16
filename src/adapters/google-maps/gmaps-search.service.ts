import { Injectable } from '@nestjs/common';
import type { Page } from 'playwright';
import { AppLogger } from '../../common/utils/logger.util';
import { PlaywrightStealthService } from '../shared/playwright-stealth.service';
import { GMAPS_SELECTORS, type GmapsSelectors } from './gmaps-selectors.config';
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
  /**
   * Listing summaries observed by probe whose key was NOT in cursor data.
   * The adapter seeds their keys into scrollUntilStable so the main scroll does not re-emit them,
   * and is responsible for applying listing-stage filters and adding URLs to collectedUrls.
   */
  freshProbeListings: GmapsListingSummary[];
  probeSeenCount: number;
  hitRate: number;
  reason: string;
  scrolls: number;
}

export interface GmapsListingSummary {
  name: string;
  url: string;
  website: string | null;
  hasWebsite: boolean;
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
   *   Pass knownDuplicateKeys from fastScrollProbe AND the keys of freshProbeListings — the probe
   *   already handled those listings, so the main scroll must not re-emit them. The adapter is
   *   responsible for routing freshProbeListings URLs into collectedUrls separately.
   */
  async scrollUntilStable(
    page: Page,
    opts: {
      maxScrolls: number;
      idleScrollsBeforeStop: number;
      onBatch: (newUrls: string[], newListings?: GmapsListingSummary[]) => { stop: boolean; reason?: string } | Promise<{ stop: boolean; reason?: string }>;
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

      const allListings = await this.collectListingSummaries(page);
      const newListings = allListings.filter((listing) => !seenInSession.has(gmapsListingKey(listing.url)));
      const newUrls = newListings.map((listing) => listing.url);
      for (const u of newUrls) seenInSession.add(gmapsListingKey(u));

      if (newUrls.length === 0) {
        consecutiveIdle++;
        if (consecutiveIdle >= opts.idleScrollsBeforeStop) return 'END_OF_FEED';
        continue;
      }
      consecutiveIdle = 0;

      const result = await opts.onBatch(newUrls, newListings);
      if (result.stop) return result.reason ?? 'CALLER_STOP';
    }

    return 'MAX_SCROLLS';
  }

  /**
   * Collect URLs (or element handles) for all visible listing cards.
   * Returns hrefs pointing to individual place pages.
   */
  async collectListingUrls(page: Page): Promise<string[]> {
    const summaries = await this.collectListingSummaries(page);
    return summaries.map((summary) => summary.url);
  }

  /**
   * Collect visible listing cards with tile-level signals that can avoid
   * unnecessary detail-page navigation.
   */
  async collectListingSummaries(page: Page): Promise<GmapsListingSummary[]> {
    const summaries: GmapsListingSummary[] = await (page as any).evaluate((selectors: GmapsSelectors) => {
      function firstMatch(parent: Element | Document, candidates: string[]): Element | null {
        for (const s of candidates) {
          try {
            const el = parent.querySelector(s);
            if (el) return el;
          } catch { /* skip */ }
        }
        return null;
      }

      function text(el: Element | null): string {
        return el?.textContent?.trim() ?? '';
      }

      function websiteHref(card: Element): string | null {
        const websiteEl = firstMatch(card, selectors.tileWebsite) as HTMLAnchorElement | null;
        const href = websiteEl?.href ?? null;
        if (!href) return null;
        try {
          const url = new URL(href);
          if (url.hostname.includes('google.') && url.pathname.includes('/maps/')) return null;
        } catch { /* keep raw href */ }
        return href;
      }

      for (const sel of selectors.listingCards) {
        try {
          const cards = Array.from(document.querySelectorAll(sel));
          if (cards.length > 0) {
            return cards
              .map((card) => {
                // Each card is usually a div wrapping an <a> that links to the place
                const a = card.tagName === 'A'
                  ? card as HTMLAnchorElement
                  : card.querySelector('a[href*="/maps/place/"]') as HTMLAnchorElement | null;
                const url = a?.href ?? '';
                const website = websiteHref(card);
                return {
                  name: text(firstMatch(card, selectors.tileName)) || 'Unknown',
                  url,
                  website,
                  hasWebsite: Boolean(website),
                };
              })
              .filter((listing) => listing.url);
          }
        } catch { /* skip */ }
      }
      return [];
    }, GMAPS_SELECTORS as unknown as GmapsSelectors);

    const seen = new Set<string>();
    const unique: GmapsListingSummary[] = [];
    for (const rawSummary of summaries as Array<GmapsListingSummary | string>) {
      const summary: GmapsListingSummary = typeof rawSummary === 'string'
        ? { name: 'Unknown', url: rawSummary, website: null, hasWebsite: false }
        : rawSummary;
      if (!summary?.url) continue;
      const key = gmapsListingKey(summary.url);
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(summary);
    }
    return unique;
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
   * - freshProbeListings: NOT in cursor — adapter applies listing-stage filters then routes to collectedUrls
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
        mode: 'NORMAL', knownDuplicateKeys: new Set(), freshProbeListings: [],
        probeSeenCount: 0, hitRate: 0, reason: 'NO_PROBE', scrolls: 0,
      };
    }

    const tailSet = new Set(opts.cursorTailIds);
    const seenKeys = new Set<string>();
    const known = new Set<string>();
    const freshSummaries: GmapsListingSummary[] = [];
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

      const allSummaries = await this.collectListingSummaries(page);

      for (const summary of allSummaries) {
        const key = gmapsListingKey(summary.url);
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);

        // Check both canonical and legacy key formats against cursorSeenIds to handle
        // existing rows written before gmapsListingKey was introduced.
        const legacyKey = placeIdFromUrl(summary.url) ?? summary.url;
        const inTail = tailSet.has(key);
        const inSeenId = opts.cursorSeenIds.has(key) || opts.cursorSeenIds.has(legacyKey);

        if (inTail || inSeenId) {
          known.add(key);
          if (inTail) hits++;
        } else {
          freshSummaries.push(summary);
        }

        if (opts.anchor && key === opts.anchor) {
          return {
            mode: 'NORMAL_FROM_ANCHOR', knownDuplicateKeys: known, freshProbeListings: freshSummaries,
            probeSeenCount: seenKeys.size, hitRate: hits / tailSet.size,
            reason: 'ANCHOR_HIT', scrolls,
          };
        }
      }

      const hitRate = hits / tailSet.size;
      if (hitRate >= threshold) {
        return {
          mode: 'NORMAL_FROM_TAIL', knownDuplicateKeys: known, freshProbeListings: freshSummaries,
          probeSeenCount: seenKeys.size, hitRate,
          reason: 'TAIL_THRESHOLD_MET', scrolls,
        };
      }

      // If the feed has been heavily reordered (no overlap after enough scrolls), bail out.
      // Return empty sets so scrollUntilStable runs from scratch — correctness preserved.
      if (scrolls >= shuffleDetect && hits === 0) {
        return {
          mode: 'NORMAL_FRESH', knownDuplicateKeys: new Set(), freshProbeListings: [],
          probeSeenCount: seenKeys.size, hitRate: 0,
          reason: 'NO_OVERLAP_SHUFFLE', scrolls,
        };
      }
    }

    return {
      mode: 'NORMAL_FROM_PARTIAL', knownDuplicateKeys: known, freshProbeListings: freshSummaries,
      probeSeenCount: seenKeys.size, hitRate: hits / tailSet.size,
      reason: 'BUDGET_EXHAUSTED', scrolls,
    };
  }
}
