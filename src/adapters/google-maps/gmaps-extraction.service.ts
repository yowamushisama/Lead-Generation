import { Injectable } from '@nestjs/common';
import type { Page } from 'playwright';
import { AppLogger } from '../../common/utils/logger.util';
import { PlaywrightStealthService } from '../shared/playwright-stealth.service';
import { GMAPS_SELECTORS, GmapsSelectors } from './gmaps-selectors.config';
import { GmapsPlace } from './gmaps-extraction.types';
import { parseRelativeDate } from './gmaps-extraction.config';

export { GmapsPlace } from './gmaps-extraction.types';

@Injectable()
export class GmapsExtractionService {
  private readonly logger = new AppLogger(GmapsExtractionService.name);

  constructor(private readonly stealthService: PlaywrightStealthService) {}

  /**
   * Extract full place data from an already-loaded detail panel.
   * The page must already be on the place detail URL before calling this.
   */
  async extractDetailPage(page: Page): Promise<Omit<GmapsPlace, 'sourceUrl'>> {
    // Google Maps SPA: the h1 node appears in the DOM early (shell render) before
    // React hydrates its text content. waitForSelector fires too soon and page.evaluate
    // reads empty strings. waitForFunction blocks until the h1 has real text.
    await (page as any).waitForFunction(
      (sels: string[]) => {
        for (const s of sels) {
          try {
            const el = document.querySelector(s);
            if (el?.textContent?.trim()) return true;
          } catch { /* skip */ }
        }
        return false;
      },
      GMAPS_SELECTORS.detailName,
      { timeout: 10000 },
    );

    // Expand the hours section so the table is visible in the DOM
    for (const sel of GMAPS_SELECTORS.detailHoursButton) {
      try {
        const btn = await (page as any).$(sel);
        if (btn) {
          await btn.click();
          await page.waitForTimeout(600);
          break;
        }
      } catch { /* not present — skip */ }
    }

    const raw = await (page as any).evaluate((sel: GmapsSelectors) => {
      function firstMatch(parent: Element | Document, selectors: string[]): Element | null {
        for (const s of selectors) {
          try { const el = parent.querySelector(s); if (el) return el; } catch { /* skip */ }
        }
        return null;
      }

      function firstMatchAll(parent: Element | Document, selectors: string[]): Element[] {
        for (const s of selectors) {
          try {
            const els = Array.from(parent.querySelectorAll(s));
            if (els.length > 0) return els;
          } catch { /* skip */ }
        }
        return [];
      }

      function text(el: Element | null): string {
        return el?.textContent?.trim() ?? '';
      }

      // ── Name ────────────────────────────────────────────────────────────────
      const name = text(firstMatch(document, sel.detailName));

      // ── Rating ──────────────────────────────────────────────────────────────
      const ratingText = text(firstMatch(document, sel.detailRating));
      const rating = ratingText ? parseFloat(ratingText) : null;

      // ── Review count ─────────────────────────────────────────────────────────
      const reviewEl = firstMatch(document, sel.detailReviewCount);
      const reviewLabel = reviewEl?.getAttribute('aria-label') ?? text(reviewEl);
      const reviewMatch = reviewLabel.match(/[\d,]+/);
      const reviewCount = reviewMatch ? parseInt(reviewMatch[0].replace(/,/g, ''), 10) : null;

      // ── Place ID from URL ─────────────────────────────────────────────────────
      // Extract the canonical ChIJ... Place ID from the !19s segment
      const chijMatch = window.location.href.match(/!19s(ChIJ[A-Za-z0-9_-]+)/);
      const placeId = chijMatch ? chijMatch[1] : null;

      // ── Categories / types ────────────────────────────────────────────────────
      const categoryEls = firstMatchAll(document, sel.detailCategories);
      const googleTypes = categoryEls.map((el) => text(el)).filter(Boolean);
      const category = googleTypes[0] ?? null;

      // ── Address ───────────────────────────────────────────────────────────────
      const addrEl = firstMatch(document, sel.detailAddress);
      const address =
        addrEl?.getAttribute('aria-label') ??
        addrEl?.getAttribute('data-tooltip') ??
        text(addrEl);

      // ── Website ───────────────────────────────────────────────────────────────
      const websiteEl = firstMatch(document, sel.detailWebsite) as HTMLAnchorElement | null;
      const website = websiteEl?.href ?? null;

      // ── Years in business (best-effort, passive — no tab clicks) ─────────────
      let yearsInBusiness: number | null = null;
      try {
        const yibCandidates = (sel as any).detailYearsInBusinessCandidates as string[];
        const yibEls = firstMatchAll(document, yibCandidates);
        const yibPattern = /(\d+)\+?\s+years?\s+in\s+business/i;
        for (const el of yibEls) {
          const t = (el.textContent ?? '') + ' ' + (el.getAttribute('aria-label') ?? '');
          const m = t.match(yibPattern);
          if (m) { yearsInBusiness = parseInt(m[1], 10); break; }
        }
      } catch { /* never throws */ }

      // ── Phone ─────────────────────────────────────────────────────────────────
      const phoneEl = firstMatch(document, sel.detailPhone);
      const phone =
        phoneEl?.getAttribute('data-item-id')?.replace('phone:tel:', '') ??
        (phoneEl as HTMLAnchorElement | null)?.href?.replace('tel:', '') ??
        phoneEl?.getAttribute('aria-label') ??
        null;

      // ── Hours ─────────────────────────────────────────────────────────────────
      const hoursEl = firstMatch(document, sel.detailHours);
      let businessHours: Record<string, string> | null = null;
      if (hoursEl) {
        // Try structured table first (present after clicking the expand button)
        const table = hoursEl.tagName === 'TABLE' ? hoursEl : hoursEl.querySelector('table');
        const rows = table ? Array.from(table.querySelectorAll('tr')) : [];
        if (rows.length > 0) {
          businessHours = {};
          for (const row of rows) {
            const cells = Array.from(row.querySelectorAll('td, th'));
            if (cells.length >= 2) {
              const day = text(cells[0]).toLowerCase().replace(/[^a-z]/g, '');
              const hours = text(cells[1]);
              if (day && hours) businessHours[day] = hours;
            }
          }
          // Discard if we got no real rows
          if (Object.keys(businessHours).length === 0) businessHours = null;
        }
        // Fall back to raw open/close summary text
        if (!businessHours) {
          const raw = text(hoursEl);
          if (raw) businessHours = { raw };
        }
      }

      // ── Last review timestamp ─────────────────────────────────────────────────
      const reviewCards = firstMatchAll(document, sel.reviewCards);
      let lastReviewRaw: string | null = null;
      if (reviewCards.length > 0) {
        const tsEl = firstMatch(reviewCards[0], sel.reviewTimestamp);
        lastReviewRaw = text(tsEl) || null;
      }

      // ── Social links ──────────────────────────────────────────────────────────
      const igEl = firstMatch(document, sel.socialInstagram) as HTMLAnchorElement | null;
      const fbEl = firstMatch(document, sel.socialFacebook) as HTMLAnchorElement | null;
      const ttEl = firstMatch(document, sel.socialTikTok) as HTMLAnchorElement | null;

      return {
        name,
        rating,
        reviewCount,
        placeId,
        googleTypes,
        category,
        address: address || null,
        website,
        yearsInBusiness,
        phone: phone || null,
        businessHours,
        lastReviewRaw,
        socialInstagram: igEl?.href ?? null,
        socialFacebook: fbEl?.href ?? null,
        socialTikTok: ttEl?.href ?? null,
      };
    }, GMAPS_SELECTORS as unknown as GmapsSelectors);

    const lastReviewAt = raw.lastReviewRaw ? parseRelativeDate(raw.lastReviewRaw) : null;

    const socialHandles: GmapsPlace['socialHandles'] = {};
    if (raw.socialInstagram) socialHandles.instagram = raw.socialInstagram;
    if (raw.socialFacebook) socialHandles.facebook = raw.socialFacebook;
    if (raw.socialTikTok) socialHandles.tiktok = raw.socialTikTok;

    return {
      placeId: raw.placeId,
      name: raw.name || null,
      rating: raw.rating,
      reviewCount: raw.reviewCount,
      category: raw.category,
      googleTypes: raw.googleTypes,
      address: raw.address,
      phone: raw.phone,
      website: raw.website,
      yearsInBusiness: raw.yearsInBusiness ?? null,
      businessHours: raw.businessHours,
      lastReviewAt,
      socialHandles,
    };
  }

  /**
   * Navigate to a listing URL, extract detail, then navigate back.
   *
   * Navigation failures (goto) return null — the URL is permanently unreachable.
   * Extraction failures (extractDetailPage) are rethrown so retryWithBackoff in
   * the adapter can retry the whole search query.
   */
  async extractFromUrl(page: Page, url: string): Promise<GmapsPlace | null> {
    try {
      await (page as any).goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    } catch (error) {
      this.logger.warn({
        message: 'Navigation failed for place URL — skipping',
        url,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }

    await page.waitForTimeout(this.stealthService.randomDelayMs(800, 2000));

    // Extraction errors bubble up to retryWithBackoff in the adapter.
    const data = await this.extractDetailPage(page);

    const missing: string[] = [];
    if (!data.name) missing.push('name');
    if (!data.phone) missing.push('phone');
    if (!data.address) missing.push('address');
    if (missing.length > 0) {
      this.logger.warn({ message: 'Empty DOM fields — selectors may be stale', url, missing });
    }

    // URL-slug fallback when DOM extraction returned no name.
    let name = data.name;
    let nameSource: GmapsPlace['nameSource'] = 'dom';
    if (!name) {
      const slugMatch = url.match(/\/maps\/place\/([^/]+)\//);
      if (slugMatch) {
        name = decodeURIComponent(slugMatch[1]).replace(/\+/g, ' ').replace(/\s+/g, ' ').trim();
        nameSource = 'url-slug';
      }
    }

    return { ...data, name, nameSource, sourceUrl: url };
  }

  /**
   * Extract tile-level data for all currently-visible listing cards without
   * clicking into each one. Used when `fetchDetails=false`.
   */
  async extractTiles(page: Page): Promise<Array<{ name: string; rating: number | null; reviewCount: number | null; category: string | null; website: string | null; url: string }>> {
    return (page as any).evaluate((sel: GmapsSelectors) => {
      function firstMatch(parent: Element | Document, selectors: string[]): Element | null {
        for (const s of selectors) {
          try { const el = parent.querySelector(s); if (el) return el; } catch { /* skip */ }
        }
        return null;
      }

      function text(el: Element | null): string { return el?.textContent?.trim() ?? ''; }

      function websiteHref(tile: Element): string | null {
        const websiteEl = firstMatch(tile, sel.tileWebsite) as HTMLAnchorElement | null;
        const href = websiteEl?.href ?? null;
        if (!href) return null;
        try {
          const url = new URL(href);
          if (url.hostname.includes('google.') && url.pathname.includes('/maps/')) return null;
        } catch { /* keep raw href */ }
        return href;
      }

      const tiles: Element[] = (() => {
        for (const s of sel.listingCards) {
          try {
            const els = Array.from(document.querySelectorAll(s));
            if (els.length > 0) return els;
          } catch { /* skip */ }
        }
        return [];
      })();

      return tiles.map((tile) => {
        const nameText = text(firstMatch(tile, sel.tileName));
        const ratingText = text(firstMatch(tile, sel.tileRating));
        const reviewText = text(firstMatch(tile, sel.tileReviewCount));
        const categoryText = text(firstMatch(tile, sel.tileCategory));
        const a = tile.tagName === 'A' ? tile : tile.querySelector('a[href*="/maps/place/"]');
        const href = (a as HTMLAnchorElement | null)?.href ?? '';
        const website = websiteHref(tile);

        const reviewMatch = reviewText.replace(/[(),]/g, '').match(/[\d,]+/);
        const reviewCount = reviewMatch ? parseInt(reviewMatch[0].replace(/,/g, ''), 10) : null;
        const rating = ratingText ? parseFloat(ratingText) : null;

        return { name: nameText || 'Unknown', rating, reviewCount, category: categoryText || null, website, url: href };
      }).filter((t) => t.url);
    }, GMAPS_SELECTORS as unknown as GmapsSelectors);
  }
}
