import { Injectable } from '@nestjs/common';
import type { Page } from 'playwright';
import { AppLogger } from '../../common/utils/logger.util';
import { LINKEDIN_SELECTORS, LinkedInSelectors } from './linkedin-selectors.config';
import { LinkedInPostFilters } from './linkedin-adapter.config';

/** Represents a single post extracted from the LinkedIn search results DOM. */
export interface LinkedInPost {
  authorName: string;
  authorUrl: string;
  headline: string;
  content: string;
  postedAt: string;
}

/**
 * Handles LinkedIn DOM extraction and client-side post filtering.
 * Extracted from `LinkedInAdapter` for single-responsibility and testability.
 *
 * The heavy lifting runs inside `page.evaluate()` so it executes in the
 * browser context. Selectors are injected from `LINKEDIN_SELECTORS` to keep
 * all selector configuration in `linkedin-selectors.config.ts`.
 */
@Injectable()
export class LinkedInExtractionService {
  private readonly logger = new AppLogger(LinkedInExtractionService.name);

  /**
   * Extracts all post data from the current search results page.
   * Returns raw posts without applying quality filters.
   */
  async extractPosts(page: Page): Promise<LinkedInPost[]> {
    try {
      // Selectors are passed from Node context into the browser evaluate —
      // edit linkedin-selectors.config.ts to fix selector drift without touching this logic.
      return await (page as any).evaluate(
        (sel: LinkedInSelectors) => {
          // ── Utility: first matching element from an ordered selector list ──────
          function firstMatch(parent: Element | Document, selectors: string[]): Element | null {
            for (const s of selectors) {
              try {
                const el = parent.querySelector(s);
                if (el) return el;
              } catch {
                /* skip invalid selector */
              }
            }
            return null;
          }

          // ── Collect post card containers ──────────────────────────────────────
          let cards: Element[] = [];
          for (const containerSel of sel.postContainers) {
            const found = Array.from(document.querySelectorAll(containerSel));
            if (found.length > 0) {
              cards = found;
              break;
            }
          }
          if (cards.length === 0) {
            // Last resort: [data-urn] elements that contain a text block
            const requiresSel = sel.postContainerFallbackRequires.join(', ');
            cards = Array.from(document.querySelectorAll('[data-urn]')).filter((el) =>
              el.querySelector(requiresSel),
            );
          }

          // Deduplicate by urn (nested [data-urn] elements can cause duplicates)
          const seen = new Set<string>();
          cards = cards.filter((el) => {
            const key = el.getAttribute('data-urn') ?? el.outerHTML.slice(0, 100);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });

          return cards.map((card) => {
            // ── Author ──────────────────────────────────────────────────────────
            const nameEl = firstMatch(card, sel.authorName);

            // Name text — prefer aria-hidden span which holds the rendered text
            const nameSpan =
              (nameEl?.querySelector('span[aria-hidden="true"]') as HTMLElement | null) ?? nameEl;
            let authorName = nameSpan?.textContent?.trim() ?? '';

            // Fallback: parse name from aria-label="View: Name Verified • ..."
            if (!authorName && nameEl) {
              const label = (nameEl as HTMLElement).getAttribute('aria-label') ?? '';
              const match = label.match(/^View(?::| )\s*([^•\n]+?)(?:\s+Verified|\s*•|$)/i);
              if (match) authorName = match[1].trim();
            }

            // Second fallback: profile image link also has aria-label with name
            if (!authorName) {
              const imgLink = firstMatch(card, sel.authorImageLink);
              if (imgLink) {
                const label = (imgLink as HTMLElement).getAttribute('aria-label') ?? '';
                const match = label.match(/^View\s+([^']+?)(?:'s| graphic link)/i);
                if (match) authorName = match[1].trim();
              }
            }

            // Profile href: use the name element if it's an <a>, else look for a link
            const hrefEl: Element | null =
              (nameEl instanceof HTMLAnchorElement ? nameEl : null) ??
              firstMatch(card, sel.authorLink);
            const rawHref = (hrefEl as HTMLAnchorElement | null)?.getAttribute('href') ?? '';

            let authorUrl = '';
            if (rawHref.startsWith('/in/')) {
              authorUrl = rawHref.split('?')[0];
            } else if (rawHref.includes('linkedin.com/in/')) {
              try {
                authorUrl = new URL(rawHref).pathname.split('?')[0];
              } catch {
                authorUrl = rawHref.split('?')[0];
              }
            }

            // ── Headline ────────────────────────────────────────────────────────
            const headlineEl = firstMatch(card, sel.headline);
            const headlineSpan =
              (headlineEl?.querySelector('span[aria-hidden="true"]') as HTMLElement | null) ??
              headlineEl;
            const headline = headlineSpan?.textContent?.trim() ?? '';

            // ── Content ─────────────────────────────────────────────────────────
            const contentEl = firstMatch(card, sel.content);
            const contentText = (() => {
              if (!contentEl) return '';
              // Collect all aria-hidden text segments (LinkedIn duplicates text for a11y)
              const ariaSpans = contentEl.querySelectorAll('span[aria-hidden="true"]');
              if (ariaSpans.length > 0) {
                return Array.from(ariaSpans)
                  .map((s) => s.textContent?.trim() ?? '')
                  .filter(Boolean)
                  .join(' ');
              }
              return contentEl.textContent?.trim() ?? '';
            })();

            // ── Posted-at ───────────────────────────────────────────────────────
            const timeEl = firstMatch(card, sel.postedAt);
            const postedAt =
              (timeEl as HTMLTimeElement | null)?.getAttribute('datetime') ??
              timeEl?.textContent?.trim() ??
              '';

            return { authorName, authorUrl, headline, content: contentText, postedAt };
          });
        },
        LINKEDIN_SELECTORS as unknown as LinkedInSelectors,
      );
    } catch (error) {
      this.logger.error({
        message: 'DOM extraction failed',
        module: 'linkedin',
        pageUrl: this.safeUrl(page),
        stack: error instanceof Error ? error.stack : undefined,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Applies client-side quality filters to extracted posts.
   *
   * - `minContentLength` (default: 10): discards posts with short content.
   * - `headlineKeywords`: discards posts whose author's headline does not
   *   contain at least one of the specified strings (case-insensitive).
   */
  applyFilters(posts: LinkedInPost[], filters: LinkedInPostFilters): LinkedInPost[] {
    const minLength = filters.minContentLength ?? 10;
    let result = posts.filter((p) => p.content.length >= minLength);

    if (filters.headlineKeywords?.length) {
      const kws = filters.headlineKeywords.map((k) => k.toLowerCase());
      const before = result.length;
      result = result.filter((p) => kws.some((kw) => p.headline.toLowerCase().includes(kw)));
      const discarded = before - result.length;

      if (discarded > 0) {
        this.logger.debug({
          message: 'Headline keyword filter discarded posts',
          module: 'linkedin',
          headlineKeywords: filters.headlineKeywords,
          discarded,
          remaining: result.length,
        });
      }
    }

    return result;
  }

  private safeUrl(page: Page): string {
    try {
      return page.url();
    } catch {
      return '<unavailable>';
    }
  }
}
