import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Page } from 'playwright';
import { RedisService } from '../../database/redis.service';
import { LinkedInStealthService, ProxyConfig } from './linkedin-stealth.service';
import { LinkedInDiagnosticsService } from './linkedin-diagnostics.service';
import { LINKEDIN_SELECTORS } from './linkedin-selectors.config';

const SESSION_KEY_PREFIX = 'linkedin:session:';
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

  async getAuthenticatedPage(proxyConfig?: ProxyConfig): Promise<Page> {
    const email = this.configService.get<string>('LINKEDIN_EMAIL');
    if (!email) throw new Error('LINKEDIN_EMAIL is not configured');

    const page = await this.stealthService.newPage(proxyConfig);
    const sessionKey = `${SESSION_KEY_PREFIX}${email}`;
    const sessionData = await this.redis.get(sessionKey);

    if (sessionData) {
      try {
        const cookies = JSON.parse(sessionData) as Array<Record<string, unknown>>;
        await (page.context() as any).addCookies(cookies);
        await page.goto('https://www.linkedin.com/feed/', {
          waitUntil: 'domcontentloaded',
          timeout: 20000,
        });
        await page.waitForTimeout(this.stealthService.randomDelayMs(800, 1500));

        if (await this.isSessionValid(page)) {
          this.logger.log({ message: 'Restored LinkedIn session from Redis cache', email });
          return page;
        }

        this.logger.warn({ message: 'Cached session expired — re-authenticating', email });
      } catch (error) {
        this.logger.warn({ message: 'Failed to restore session — re-authenticating', error: String(error) });
      }
    }

    await this.login(page, email);
    return page;
  }

  async isSessionValid(page: Page): Promise<boolean> {
    try {
      const url = page.url();
      if (url.includes('/login') || url.includes('/authwall') || url.includes('/checkpoint')) {
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
      timeout: 20000,
    });
    await this.diagnostics.logPageState(page, { phase: 'login-page', email });
    await page.waitForTimeout(this.stealthService.randomDelayMs(800, 1500));

    await (page as any).fill('#username', email);
    await page.waitForTimeout(this.stealthService.randomDelayMs(300, 700));

    await (page as any).fill('#password', password);
    await page.waitForTimeout(this.stealthService.randomDelayMs(400, 900));

    await (page as any).click('[data-litms-control-urn="login-submit"]');

    await (page as any).waitForNavigation({
      waitUntil: 'domcontentloaded',
      timeout: 20000,
    }).catch(() => {});

    await this.diagnostics.logPageState(page, { phase: 'post-login', email });

    const currentUrl = page.url();
    if (currentUrl.includes('checkpoint') || currentUrl.includes('challenge')) {
      this.logger.warn({
        message: 'LinkedIn 2FA/checkpoint page detected — manual action required',
        url: currentUrl,
      });
      // Do NOT cache checkpoint cookies — restoring them on the next run would
      // lock the adapter into repeatedly reusing an invalid session state.
      throw new Error(`LinkedIn login blocked by checkpoint: ${currentUrl}`);
    }

    const cookies = await (page.context() as any).cookies();
    const sessionKey = `${SESSION_KEY_PREFIX}${email}`;
    await this.redis.set(sessionKey, JSON.stringify(cookies));
    await this.redis.expire(sessionKey, SESSION_TTL_SECONDS);

    this.logger.log({ message: 'LinkedIn login successful — session cached in Redis', email });
  }
}
