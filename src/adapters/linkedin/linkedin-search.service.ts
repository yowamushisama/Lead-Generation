import { Injectable } from '@nestjs/common';
import type { Page } from 'playwright';
import { AppLogger } from '../../common/utils/logger.util';
import { LinkedInStealthService } from './linkedin-stealth.service';
import { LINKEDIN_SELECTORS } from './linkedin-selectors.config';
import { LinkedInSearchFilters } from './linkedin-adapter.config';

/**
 * Builds a LinkedIn content-search URL from a keyword and optional filters.
 * Exported as a standalone function so `dump-linkedin-dom.ts` can use it
 * without going through NestJS DI.
 */
export function buildSearchUrl(keyword: string, filters: LinkedInSearchFilters = {}): string {
  const params = new URLSearchParams();
  params.set('keywords', keyword);
  params.set('sortBy', 'date_posted');

  if (filters.datePosted) {
    params.set('datePosted', filters.datePosted);
  }
  if (filters.network?.length) {
    params.set('network', JSON.stringify(filters.network));
  }
  if (filters.contentType) {
    params.set('contentType', filters.contentType);
  }

  return `https://www.linkedin.com/search/results/content/?${params.toString()}`;
}

/**
 * Handles LinkedIn search navigation, scrolling, and rate-limit detection.
 * Extracted from `LinkedInAdapter` for single-responsibility and testability.
 */
@Injectable()
export class LinkedInSearchService {
  private readonly logger = new AppLogger(LinkedInSearchService.name);

  constructor(private readonly stealthService: LinkedInStealthService) {}

  /**
   * Builds a LinkedIn content-search URL.
   * Delegates to the standalone `buildSearchUrl` function.
   */
  buildSearchUrl(keyword: string, filters: LinkedInSearchFilters = {}): string {
    return buildSearchUrl(keyword, filters);
  }

  /**
   * Navigates the page to the LinkedIn content-search results for a keyword,
   * applying a human-like mouse movement and random delay before navigation.
   */
  async navigateToSearch(
    page: Page,
    keyword: string,
    filters: LinkedInSearchFilters,
    organizationId: string,
  ): Promise<void> {
    const url = buildSearchUrl(keyword, filters);

    // Human-like behaviour — move mouse to a random position before navigating
    const mouseX = Math.floor(Math.random() * 800) + 100;
    const mouseY = Math.floor(Math.random() * 400) + 100;

    this.logger.verbose({
      message: 'Pre-navigation mouse move',
      module: 'linkedin',
      keyword,
      organizationId,
      mouseX,
      mouseY,
    });

    try {
      await (page as any).mouse.move(mouseX, mouseY);
      await page.waitForTimeout(this.stealthService.randomDelayMs(800, 2000));
      await (page as any).goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

      // Wait for at least one post container to appear (JS-rendered SPA)
      await (page as any)
        .waitForSelector(LINKEDIN_SELECTORS.waitForPost, { timeout: 10000 })
        .catch(() => {});

      this.logger.debug({
        message: 'Navigated to LinkedIn search',
        module: 'linkedin',
        keyword,
        organizationId,
        url,
      });
    } catch (error) {
      this.logger.error({
        message: 'Navigation to LinkedIn search failed',
        module: 'linkedin',
        keyword,
        organizationId,
        url,
        pageUrl: this.safeUrl(page),
        stack: error instanceof Error ? error.stack : undefined,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Scrolls the page in multiple steps to trigger lazy-loaded post cards.
   * Each step scrolls 600px with a human-like random delay between steps.
   */
  async scroll(page: Page, steps = 5): Promise<void> {
    for (let i = 0; i < steps; i++) {
      await (page as any).evaluate(() => window.scrollBy(0, 600));
      await page.waitForTimeout(this.stealthService.randomDelayMs(600, 1200));
    }

    // Allow newly loaded content to settle
    await (page as any)
      .waitForSelector(LINKEDIN_SELECTORS.waitForPost, { timeout: 5000 })
      .catch(() => {});
  }

  /**
   * Returns true if LinkedIn is showing a rate-limit page, CAPTCHA, or checkpoint.
   * Checks both the current URL and known soft-block DOM elements.
   */
  async isRateLimited(page: Page): Promise<boolean> {
    const url = this.safeUrl(page);
    const urlBlocked =
      url.includes('checkpoint') ||
      url.includes('captcha') ||
      url.includes('authwall') ||
      url.includes('challenge');

    if (urlBlocked) {
      this.logger.debug({
        message: 'Rate limit detected via URL',
        module: 'linkedin',
        url,
      });
      return true;
    }

    // Soft-block: LinkedIn may show an inline CAPTCHA/challenge without changing the URL
    for (const sel of LINKEDIN_SELECTORS.captchaDetection) {
      const el = await (page as any).$(sel).catch(() => null);
      if (el) {
        this.logger.debug({
          message: 'Rate limit detected via DOM element',
          module: 'linkedin',
          selector: sel,
          url,
        });
        return true;
      }
    }

    return false;
  }

  private safeUrl(page: Page): string {
    try {
      return page.url();
    } catch {
      return '<unavailable>';
    }
  }
}
