import { Injectable } from '@nestjs/common';
import type { Page } from 'playwright';
import { AppLogger } from '../../common/utils/logger.util';
import { PlaywrightStealthService } from '../shared/playwright-stealth.service';
import { GMAPS_SELECTORS } from './gmaps-selectors.config';
import { scrollPage } from '../shared/page-helpers';
import { GMAPS_PROFILE_KEY } from './gmaps-adapter.config';

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
    let containerSel: string | undefined;
    for (const sel of GMAPS_SELECTORS.feedContainer) {
      const el = await (page as any).$(sel).catch(() => null);
      if (el) { containerSel = sel; break; }
    }

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
   */
  async scrollUntilStable(
    page: Page,
    opts: {
      maxScrolls: number;
      idleScrollsBeforeStop: number;
      onBatch: (newUrls: string[]) => { stop: boolean; reason?: string } | Promise<{ stop: boolean; reason?: string }>;
      onScrollStep?: () => void;
    },
  ): Promise<string> {
    let containerSel: string | undefined;
    for (const sel of GMAPS_SELECTORS.feedContainer) {
      const el = await (page as any).$(sel).catch(() => null);
      if (el) { containerSel = sel; break; }
    }

    const seenInSession = new Set<string>();
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
      const newUrls = allUrls.filter((u) => !seenInSession.has(u));
      for (const u of newUrls) seenInSession.add(u);

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
}
