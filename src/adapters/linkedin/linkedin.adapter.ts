import { Injectable } from '@nestjs/common';
import type { Page } from 'playwright';
import { BaseAdapter } from '../base.adapter';
import { AdapterConfig } from '../../common/interfaces/adapter.interface';
import { RawLeadInput } from '../../common/interfaces/lead-input.interface';
import { LeadSource } from '../../common/enums/lead-source.enum';
import { LinkedInStealthService } from './linkedin-stealth.service';
import { LinkedInSessionService } from './linkedin-session.service';
import { LinkedInDiagnosticsService } from './linkedin-diagnostics.service';
import { LINKEDIN_SELECTORS, LinkedInSelectors } from './linkedin-selectors.config';

interface LinkedInPost {
  authorName: string;
  authorUrl: string;
  headline: string;
  content: string;
  postedAt: string;
}

@Injectable()
export class LinkedInAdapter extends BaseAdapter {
  readonly name = LeadSource.LINKEDIN;
  readonly sourceType = 'intent' as const;

  constructor(
    private readonly stealthService: LinkedInStealthService,
    private readonly sessionService: LinkedInSessionService,
    private readonly diagnostics: LinkedInDiagnosticsService,
  ) {
    super();
  }

  async isHealthy(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      const response = await fetch('https://www.linkedin.com', {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible)' },
      });
      clearTimeout(timer);
      return response.status < 500;
    } catch {
      return false;
    }
  }

  async *collect(config: AdapterConfig): AsyncGenerator<RawLeadInput> {
    this.validateConfig(config);

    const keywords = config.keywords ?? [];
    if (keywords.length === 0) {
      this.logWarn('No keywords configured for LinkedIn adapter', {
        organizationId: config.organizationId,
      });
      return;
    }

    const maxResults = config.maxResults ?? 100;
    let yielded = 0;
    const seenAuthors = new Set<string>();

    // Authenticate once — reuse the same page across all keywords.
    // The persistent browser context means LinkedIn sees the same device every time.
    let page: Page | null = null;
    try {
      page = await this.sessionService.getAuthenticatedPage();

      for (const keyword of keywords) {
        if (yielded >= maxResults) break;

        try {
          const searchUrl = `https://www.linkedin.com/search/results/content/?keywords=${encodeURIComponent(keyword)}&sortBy=date_posted`;

          // Human-like behaviour before navigating
          await (page as any).mouse.move(
            Math.floor(Math.random() * 800) + 100,
            Math.floor(Math.random() * 400) + 100,
          );
          await page.waitForTimeout(this.stealthService.randomDelayMs(800, 2000));

          await (page as any).goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await this.diagnostics.logPageState(page, {
            phase: 'search-results',
            keyword,
            organizationId: config.organizationId,
          });

          // Detect and handle rate-limiting / CAPTCHA — log and skip keyword (no browser restart)
          if (await this.isRateLimited(page)) {
            this.logWarn('LinkedIn rate limit / checkpoint detected — skipping keyword', {
              keyword,
              organizationId: config.organizationId,
            });
            continue;
          }

          // Wait for at least one post container to appear (JS-rendered)
          await (page as any)
            .waitForSelector(LINKEDIN_SELECTORS.waitForPost, { timeout: 10000 })
            .catch(() => {});

          // Scroll in 5 steps to trigger lazy-loaded post cards
          for (let i = 0; i < 5; i++) {
            await (page as any).evaluate(() => window.scrollBy(0, 600));
            await page.waitForTimeout(this.stealthService.randomDelayMs(600, 1200));
          }

          // Wait for new content to settle after scrolling
          await (page as any)
            .waitForSelector(LINKEDIN_SELECTORS.waitForPost, { timeout: 5000 })
            .catch(() => {});

          await this.diagnostics.logSearchDiagnostics(page, {
            phase: 'pre-extract',
            keyword,
            organizationId: config.organizationId,
          });

          const posts = await this.extractPosts(page);
          this.log(`Found ${posts.length} posts for keyword: "${keyword}"`, {
            organizationId: config.organizationId,
          });

          for (const post of posts) {
            if (yielded >= maxResults) break;

            // One lead per LinkedIn profile — skip repeated authors seen in this run
            if (post.authorUrl && seenAuthors.has(post.authorUrl)) continue;
            if (post.authorUrl) seenAuthors.add(post.authorUrl);

            await page.waitForTimeout(this.stealthService.randomDelayMs(300, 1000));

            yield {
              externalId: post.authorUrl || undefined,
              source: LeadSource.LINKEDIN,
              sourceType: 'intent',
              sourceUrl: post.authorUrl
                ? this.buildSourceUrl('https://www.linkedin.com', post.authorUrl)
                : undefined,
              name: post.authorName,
              headline: this.sanitizeText(post.headline),
              originalContent: this.sanitizeText(post.content),
              metadata: {
                keyword,
                postedAt: post.postedAt,
                campaignId: config.campaignId,
                scrapedAt: new Date().toISOString(),
              },
            };
            yielded++;
          }
        } catch (error) {
          this.logError(`Error scraping LinkedIn for keyword: "${keyword}"`, error);
          // Continue to next keyword — don't abort the whole run
        }
      }
    } catch (error) {
      this.logError('Failed to establish LinkedIn session', error);
    } finally {
      if (page) await (page as any).close().catch(() => {});
    }

    this.log(`LinkedIn collect complete: ${yielded} leads`, {
      organizationId: config.organizationId,
    });
  }

  private async extractPosts(page: Page): Promise<LinkedInPost[]> {
    // Selectors are passed from Node context into the browser evaluate — edit
    // linkedin-selectors.config.ts to fix selector drift without touching this logic.
    return (page as any).evaluate(
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

        // ── Collect post card containers ────────────────────────────────────────
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

        return cards
          .map((card) => {
            // ── Author ────────────────────────────────────────────────────────
            const nameEl = firstMatch(card, sel.authorName);

            // Name text — prefer aria-hidden span which holds the rendered text
            const nameSpan =
              (nameEl?.querySelector('span[aria-hidden="true"]') as HTMLElement | null) ?? nameEl;
            let authorName = nameSpan?.textContent?.trim() ?? '';

            // Fallback: parse name from aria-label="View: Name Verified • ..."
            // The actor meta-link always carries this label with the full name
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

            // ── Headline ──────────────────────────────────────────────────────
            const headlineEl = firstMatch(card, sel.headline);
            const headlineSpan =
              (headlineEl?.querySelector('span[aria-hidden="true"]') as HTMLElement | null) ??
              headlineEl;
            const headline = headlineSpan?.textContent?.trim() ?? '';

            // ── Content ───────────────────────────────────────────────────────
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

            // ── Posted-at ─────────────────────────────────────────────────────
            const timeEl = firstMatch(card, sel.postedAt);
            const postedAt =
              (timeEl as HTMLTimeElement | null)?.getAttribute('datetime') ??
              timeEl?.textContent?.trim() ??
              '';

            return { authorName, authorUrl, headline, content: contentText, postedAt };
          })
          .filter((p) => p.content.length > 10); // require meaningful content; author is optional
      },
      LINKEDIN_SELECTORS as unknown as LinkedInSelectors,
    );
  }

  private async isRateLimited(page: Page): Promise<boolean> {
    const url = page.url();
    const urlBlocked =
      url.includes('checkpoint') ||
      url.includes('captcha') ||
      url.includes('authwall') ||
      url.includes('challenge');
    if (urlBlocked) return true;

    // Soft-block detection: LinkedIn may show an inline CAPTCHA/challenge
    // without changing the URL. Check for known challenge DOM elements.
    for (const sel of LINKEDIN_SELECTORS.captchaDetection) {
      const el = await (page as any).$(sel).catch(() => null);
      if (el) return true;
    }
    return false;
  }
}
