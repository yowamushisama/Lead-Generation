import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { AppLogger } from '../../common/utils/logger.util';
import { ConfigService } from '@nestjs/config';
import { chromium } from 'playwright-extra';
import type { BrowserContext, Page } from 'playwright';
import * as path from 'path';

type StealthPluginFactory = () => unknown;
type ChromiumPlugin = Parameters<typeof chromium.use>[0];

const stealthPluginModule = require('puppeteer-extra-plugin-stealth') as
  | StealthPluginFactory
  | { default?: StealthPluginFactory };
const createStealthPlugin =
  typeof stealthPluginModule === 'function' ? stealthPluginModule : stealthPluginModule.default;

if (typeof createStealthPlugin !== 'function') {
  throw new Error('Failed to load puppeteer-extra-plugin-stealth');
}

chromium.use(createStealthPlugin() as ChromiumPlugin);

/**
 * Generic Playwright browser context with stealth anti-bot evasion.
 * One persistent context per `profileKey` — state (cookies, localStorage)
 * survives across process restarts so the target site sees the same device.
 *
 * Inject this in any adapter that needs a headless browser session.
 * Pass a distinct `profileKey` per adapter (e.g. 'linkedin', 'gmaps') so
 * each adapter gets its own isolated browser profile directory.
 */
@Injectable()
export class PlaywrightStealthService implements OnModuleDestroy {
  private readonly logger = new AppLogger(PlaywrightStealthService.name);
  private readonly contexts = new Map<string, BrowserContext>();

  constructor(private readonly configService: ConfigService) {}

  async getPersistentContext(profileKey = 'browser'): Promise<BrowserContext> {
    if (this.contexts.has(profileKey)) {
      return this.contexts.get(profileKey)!;
    }

    const envKey = profileKey.toUpperCase().replace(/-/g, '_');
    const headlessEnv = this.configService.get<string>(`${envKey}_HEADLESS`, 'true');
    const headless = headlessEnv.toLowerCase() !== 'false';

    const userDataDir =
      this.configService.get<string>(`${envKey}_USER_DATA_DIR`) ??
      path.resolve(process.cwd(), 'data', `${profileKey}-profile`);

    const linuxArgs =
      process.platform === 'linux'
        ? ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        : [];

    const launchArgs = [
      ...linuxArgs,
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
    ];

    const timezoneId =
      this.configService.get<string>(`${envKey}_TIMEZONE`) ?? 'America/New_York';

    const ctx: BrowserContext = await (chromium as any).launchPersistentContext(userDataDir, {
      headless,
      args: launchArgs,
      viewport: this.randomViewport(),
      userAgent: this.randomUserAgent(),
      locale: 'en-US',
      timezoneId,
      extraHTTPHeaders: {
        'accept-language': 'en-US,en;q=0.9',
        'accept-encoding': 'gzip, deflate, br',
      },
    });

    await ctx.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      // @ts-ignore
      window.chrome = { runtime: {} };
    });

    this.contexts.set(profileKey, ctx);
    this.logger.log({ message: 'Persistent browser context launched', profileKey, userDataDir, headless });
    return ctx;
  }

  async newPage(profileKey = 'browser'): Promise<Page> {
    const ctx = await this.getPersistentContext(profileKey);
    return ctx.newPage();
  }

  async onModuleDestroy(): Promise<void> {
    for (const [key, ctx] of this.contexts.entries()) {
      await (ctx as any).close().catch(() => {});
      this.logger.log({ message: 'Browser context closed', profileKey: key });
    }
    this.contexts.clear();
  }

  randomDelayMs(min = 500, max = 2000): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  randomViewport(): { width: number; height: number } {
    const viewports = [
      { width: 1920, height: 1080 },
      { width: 1366, height: 768 },
      { width: 1440, height: 900 },
      { width: 1280, height: 800 },
      { width: 1536, height: 864 },
    ];
    return viewports[Math.floor(Math.random() * viewports.length)];
  }

  randomUserAgent(): string {
    const agents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
    ];
    return agents[Math.floor(Math.random() * agents.length)];
  }
}
