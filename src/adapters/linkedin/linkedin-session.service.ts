import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Page } from 'playwright';
import { RedisService } from '../../database/redis.service';
import { LinkedInStealthService } from './linkedin-stealth.service';
import { LinkedInDiagnosticsService } from './linkedin-diagnostics.service';
import { LINKEDIN_SELECTORS } from './linkedin-selectors.config';

// Redis key stores only a timestamp — the actual session lives in the
// persistent browser profile directory on disk.
const LAST_LOGIN_KEY_PREFIX = 'linkedin:last-login:';
const SESSION_TTL_SECONDS = 12 * 60 * 60; // 12 hours

@Injectable()
export class LinkedInSessionService {
  private readonly logger = new Logger(LinkedInSessionService.name);

  constructor(
    private readonly stealthService: LinkedInStealthService,
    private readonly redis: RedisService,
    private readonly configService: ConfigService,
    private readonly diagnostics: LinkedInDiagnosticsService,
  ) {}

  /**
   * Returns an authenticated Playwright page.
   *
   * Because the browser context is persistent (stored on disk), cookies and
   * localStorage survive across process restarts — no need to replay cookies
   * from Redis. We navigate to the feed, wait for the nav element, and only
   * re-login when the session has actually expired.
   */
  async getAuthenticatedPage(): Promise<Page> {
    const email = this.configService.get<string>('LINKEDIN_EMAIL');
    if (!email) throw new Error('LINKEDIN_EMAIL is not configured');

    const page = await this.stealthService.newPage();

    // Navigate to feed — persistent context already has the cookies/localStorage
    await page.goto('https://www.linkedin.com/feed/', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    // Wait for the nav element to render (JS-heavy SPA)
    await page
      .waitForSelector(LINKEDIN_SELECTORS.sessionValid[0], { timeout: 8000 })
      .catch(() => {});

    if (await this.isSessionValid(page)) {
      this.logger.log({ message: 'LinkedIn session valid — reusing persistent context', email });
      return page;
    }

    this.logger.log({ message: 'Session not found in persistent context — logging in', email });
    await this.login(page, email);
    return page;
  }

  async isSessionValid(page: Page): Promise<boolean> {
    try {
      const url = page.url();
      if (
        url.includes('/login') ||
        url.includes('/authwall') ||
        url.includes('/checkpoint') ||
        url.includes('/challenge') ||
        url.includes('device-registration')
      ) {
        return false;
      }
      for (const sel of LINKEDIN_SELECTORS.sessionValid) {
        const el = await (page as any).$(sel);
        if (el) return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  private async login(page: Page, email: string): Promise<void> {
    const password = this.configService.get<string>('LINKEDIN_PASSWORD');
    if (!password) throw new Error('LINKEDIN_PASSWORD is not configured');

    this.logger.log({ message: 'Starting LinkedIn login flow', email });
    this.diagnostics.logCredentialShape(email, password);

    await page.goto('https://www.linkedin.com/login', {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    // Detect device verification / checkpoint BEFORE attempting to fill the form
    const urlAfterNav = page.url();
    if (
      urlAfterNav.includes('checkpoint') ||
      urlAfterNav.includes('challenge') ||
      urlAfterNav.includes('device-registration')
    ) {
      this.logger.error({
        message: 'LinkedIn requires device verification before login — set LINKEDIN_HEADLESS=false and complete verification manually once',
        url: urlAfterNav,
      });
      throw new Error(`LinkedIn device verification required: ${urlAfterNav}`);
    }

    await this.diagnostics.logPageState(page, { phase: 'login-page', email });
    await page.waitForTimeout(this.stealthService.randomDelayMs(600, 1200));

    // Wait explicitly for form fields — avoids fill() timeout when page redirects
    await page.waitForSelector('#username', { timeout: 15000 });
    await page.locator('#username').fill(email);
    await page.waitForTimeout(this.stealthService.randomDelayMs(300, 700));

    await page.waitForSelector('#password', { timeout: 10000 });
    await page.locator('#password').fill(password);
    await page.waitForTimeout(this.stealthService.randomDelayMs(400, 900));

    await page.locator('[data-litms-control-urn="login-submit"]').click();

    await page
      .waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 20000 })
      .catch(() => {});

    await this.diagnostics.logPageState(page, { phase: 'post-login', email });

    const currentUrl = page.url();
    if (
      currentUrl.includes('checkpoint') ||
      currentUrl.includes('challenge') ||
      currentUrl.includes('device-registration')
    ) {
      this.logger.warn({
        message: 'LinkedIn 2FA/checkpoint page detected after login — manual action required',
        url: currentUrl,
      });
      throw new Error(`LinkedIn login blocked by checkpoint: ${currentUrl}`);
    }

    // Record last login time in Redis (the actual session lives on disk)
    const lastLoginKey = `${LAST_LOGIN_KEY_PREFIX}${email}`;
    await this.redis.set(lastLoginKey, new Date().toISOString(), SESSION_TTL_SECONDS);

    this.logger.log({
      message: 'LinkedIn login successful — session persisted to disk profile',
      email,
    });
  }
}
