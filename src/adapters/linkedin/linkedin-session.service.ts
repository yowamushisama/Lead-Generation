import { Injectable, Optional } from '@nestjs/common';
import { AppLogger } from '../../common/utils/logger.util';
import { ConfigService } from '@nestjs/config';
import type { Page } from 'playwright';
import { RedisService } from '../../database/redis.service';
import { LinkedInStealthService } from './linkedin-stealth.service';
import { LinkedInDiagnosticsService } from './linkedin-diagnostics.service';
import { LINKEDIN_SELECTORS } from './linkedin-selectors.config';
import { LinkedInAlertService } from './linkedin-alert.service';

// Redis key stores only a timestamp — the actual session lives in the
// persistent browser profile directory on disk.
const LAST_LOGIN_KEY_PREFIX = 'linkedin:last-login:';
const SESSION_TTL_SECONDS = 12 * 60 * 60; // 12 hours

@Injectable()
export class LinkedInSessionService {
  private readonly logger = new AppLogger(LinkedInSessionService.name);

  constructor(
    private readonly stealthService: LinkedInStealthService,
    private readonly redis: RedisService,
    private readonly configService: ConfigService,
    private readonly diagnostics: LinkedInDiagnosticsService,
    @Optional() private readonly alertService?: LinkedInAlertService,
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

  async revalidate(page: Page): Promise<void> {
    if (await this.isSessionValid(page)) return;
    this.logger.warn({ message: 'LinkedIn mid-run session expired — re-authenticating', module: 'linkedin' });
    const email = this.configService.get<string>('LINKEDIN_EMAIL') ?? '';
    await page.goto('https://www.linkedin.com/feed/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    if (!(await this.isSessionValid(page))) {
      await this.login(page, email);
    }
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
      await this.alertService?.emit('checkpoint', { url: urlAfterNav, email });
      throw new Error(`LinkedIn device verification required: ${urlAfterNav}`);
    }

    await this.diagnostics.logPageState(page, { phase: 'login-page', email });
    await page.waitForTimeout(this.stealthService.randomDelayMs(600, 1200));

    // LinkedIn changed login form IDs to dynamic React-generated values (e.g. :r3:).
    // Use label-based and autocomplete-based locators — stable across redesigns.
    // Fallback chain: getByLabel → autocomplete attribute → visible type selector.
    const emailLocator = page
      .locator([
        'input[autocomplete="webauthn"]',
        'input[autocomplete="username"]',
        '#username',
        'input[name="session_key"]',
        'input[type="text"]:visible',
      ].join(', '))
      .first();

    await emailLocator.waitFor({ state: 'visible', timeout: 20000 });
    await emailLocator.fill(email);
    await page.waitForTimeout(this.stealthService.randomDelayMs(300, 700));

    const passwordLocator = page
      .locator([
        'input[autocomplete="current-password"]',
        '#password',
        'input[name="session_password"]',
        'input[type="password"]:visible',
      ].join(', '))
      .first();

    await passwordLocator.waitFor({ state: 'visible', timeout: 10000 });
    await passwordLocator.fill(password);
    await page.waitForTimeout(this.stealthService.randomDelayMs(400, 900));

    // Submit — try old data-attribute first, fall back to visible "Sign in" button
    const submitLocator = page
      .locator([
        '[data-litms-control-urn="login-submit"]',
        'button[type="submit"]',
      ].join(', '))
      .or(page.getByRole('button', { name: /^sign in$/i }))
      .filter({ hasNot: page.locator('[aria-hidden="true"]') })
      .first();

    await submitLocator.click();

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
      await this.alertService?.emit('checkpoint', { url: currentUrl, email });
      const isInteractive =
        this.configService.get<string>('LINKEDIN_HEADLESS') === 'false' &&
        this.configService.get<string>('LINKEDIN_INTERACTIVE') === 'true';
      if (isInteractive) {
        this.logger.warn({
          message: 'LinkedIn checkpoint — waiting up to 10 min for operator to complete 2FA in browser',
          url: currentUrl,
        });
        await page.waitForURL(/\/feed\//, { timeout: 10 * 60 * 1000 });
      } else {
        throw new Error(`LinkedIn login blocked by checkpoint: ${currentUrl}`);
      }
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
