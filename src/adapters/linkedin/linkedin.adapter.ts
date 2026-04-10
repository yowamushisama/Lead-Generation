import { Injectable } from '@nestjs/common';
import type { Page } from 'playwright';
import { BaseAdapter } from '../base.adapter';
import { AdapterConfig } from '../../common/interfaces/adapter.interface';
import { RawLeadInput } from '../../common/interfaces/lead-input.interface';
import { LeadSource } from '../../common/enums/lead-source.enum';
import { LinkedInStealthService } from './linkedin-stealth.service';
import { LinkedInSessionService } from './linkedin-session.service';
import { LinkedInProxyService } from './linkedin-proxy.service';
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
    private readonly proxyService: LinkedInProxyService,
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
      this.logWarn('No keywords configured for LinkedIn adapter', { organizationId: config.organizationId });
      return;
    }

    const maxResults = config.maxResults ?? 100;
    let yielded = 0;
    const seenAuthors = new Set<string>();

    for (const keyword of keywords) {
      if (yielded >= maxResults) break;

      let proxy = this.proxyService.getNextProxy();
      let page: Page | null = null;

      try {
        page = await this.sessionService.getAuthenticatedPage(proxy);
        const searchUrl = `https://www.linkedin.com/search/results/content/?keywords=${encodeURIComponent(keyword)}&sortBy=date_posted`;

        // Human-like behaviour before navigating
        await (page as any).mouse.move(
          Math.floor(Math.random() * 800) + 100,
          Math.floor(Math.random() * 400) + 100,
        );
        await page.waitForTimeout(this.stealthService.randomDelayMs(800, 2500));

        await (page as any).goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await this.diagnostics.logPageState(page, {
          phase: 'search-results',
          keyword,
          organizationId: config.organizationId,
        });

        // Wait for at least one post container to appear (JS-rendered)
        await (page as any)
          .waitForSelector(LINKEDIN_SELECTORS.waitForPost, { timeout: 10000 })
          .catch(() => {});
        await page.waitForTimeout(this.stealthService.randomDelayMs(1000, 2200));

        // Detect and handle rate-limiting / CAPTCHA
        if (await this.isRateLimited(page)) {
          this.logWarn('LinkedIn rate limit / checkpoint detected — rotating proxy', {
            keyword,
            organizationId: config.organizationId,
          });
          if (proxy) this.proxyService.markFailed(proxy);
          proxy = this.proxyService.getNextProxy();
          await (page as any).close().catch(() => {});
          page = await this.sessionService.getAuthenticatedPage(proxy);
          await (page as any).goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await (page as any)
            .waitForSelector(LINKEDIN_SELECTORS.waitForPost, { timeout: 10000 })
            .catch(() => {});
          await this.diagnostics.logPageState(page, {
            phase: 'search-results-after-rotation',
            keyword,
            organizationId: config.organizationId,
          });
          await page.waitForTimeout(this.stealthService.randomDelayMs(1000, 2000));
        }

        // Scroll in steps to trigger lazy-loaded post cards
        for (const distance of [300, 600, 400]) {
          await (page as any).evaluate((d: number) => window.scrollBy(0, d), distance);
          await page.waitForTimeout(this.stealthService.randomDelayMs(400, 900));
        }
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

          await page.waitForTimeout(this.stealthService.randomDelayMs(500, 2000));

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
      } finally {
        if (page) await (page as any).close().catch(() => {});
      }
    }

    this.log(`LinkedIn collect complete: ${yielded} leads`, { organizationId: config.organizationId });
  }

  private async extractPosts(page: Page): Promise<LinkedInPost[]> {
    // Selectors are passed from Node context into the browser evaluate — edit
    // linkedin-selectors.config.ts to fix selector drift without touching this logic.
    return (page as any).evaluate((sel: LinkedInSelectors) => {
      // ── Utility: first matching element from an ordered selector list ──────
      function firstMatch(parent: Element | Document, selectors: string[]): Element | null {
        for (const s of selectors) {
          try {
            const el = parent.querySelector(s);
            if (el) return el;
          } catch { /* skip invalid selector */ }
        }
        return null;
      }

      // ── Collect post card containers ────────────────────────────────────────
      let cards: Element[] = [];
      for (const containerSel of sel.postContainers) {
        const found = Array.from(document.querySelectorAll(containerSel));
        if (found.length > 0) { cards = found; break; }
      }
      if (cards.length === 0) {
        // Last resort: [data-urn] elements that contain a text block
        const requiresSel = sel.postContainerFallbackRequires.join(', ');
        cards = Array.from(document.querySelectorAll('[data-urn]')).filter(
          (el) => el.querySelector(requiresSel),
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
          const authorName = nameSpan?.textContent?.trim() ?? '';

          // Profile href: use the name element if it's an <a>, else look for a link
          const hrefEl: Element | null =
            (nameEl instanceof HTMLAnchorElement ? nameEl : null) ??
            firstMatch(card, sel.authorLink);
          const rawHref = (hrefEl as HTMLAnchorElement | null)?.getAttribute('href') ?? '';

          let authorUrl = '';
          if (rawHref.startsWith('/in/')) {
            authorUrl = rawHref.split('?')[0];
          } else if (rawHref.includes('linkedin.com/in/')) {
            try { authorUrl = new URL(rawHref).pathname.split('?')[0]; }
            catch { authorUrl = rawHref.split('?')[0]; }
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
            timeEl?.textContent?.trim() ?? '';

          return { authorName, authorUrl, headline, content: contentText, postedAt };
        })
        .filter((p) => p.content.length > 10); // require meaningful content; author is optional
    }, LINKEDIN_SELECTORS as unknown as LinkedInSelectors);
  }

  private async isRateLimited(page: Page): Promise<boolean> {
    const url = page.url();
    return (
      url.includes('checkpoint') ||
      url.includes('captcha') ||
      url.includes('authwall') ||
      url.includes('challenge')
    );
  }
}
