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

// Apply stealth plugin globally once
chromium.use(createStealthPlugin() as ChromiumPlugin);

@Injectable()
export class LinkedInStealthService implements OnModuleDestroy {
  private readonly logger = new AppLogger(LinkedInStealthService.name);
  private context: BrowserContext | null = null;

  constructor(private readonly configService: ConfigService) {}

  /**
   * Returns the single persistent browser context, launching it if needed.
   * Uses launchPersistentContext so all browser state (cookies, localStorage,
   * IndexedDB) survives between runs — LinkedIn sees the same "device" every time.
   */
  async getPersistentContext(): Promise<BrowserContext> {
    if (this.context) return this.context;

    const headless =
      this.configService.get<string>('LINKEDIN_HEADLESS', 'true').toLowerCase() !== 'false';

    const userDataDir =
      this.configService.get<string>('LINKEDIN_USER_DATA_DIR') ??
      path.resolve(process.cwd(), 'data', 'linkedin-profile');

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
      this.configService.get<string>('LINKEDIN_TIMEZONE') ?? 'America/New_York';

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

    // Mask webdriver flag and other automation signals
    await ctx.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      // @ts-ignore
      window.chrome = { runtime: {} };
    });

    this.context = ctx;
    this.logger.log({ message: 'Persistent browser context launched', userDataDir, headless });
    return this.context;
  }

  /**
   * Opens a new page inside the single persistent context.
   */
  async newPage(): Promise<Page> {
    const ctx = await this.getPersistentContext();
    const page = await ctx.newPage();
    this.logger.log({ message: 'New page created in persistent context' });
    return page;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.context) {
      await (this.context as any).close().catch(() => {});
      this.context = null;
      this.logger.log({ message: 'Persistent browser context closed' });
    }
  }

  randomDelayMs(min = 500, max = 2000): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private randomViewport(): { width: number; height: number } {
    const viewports = [
      { width: 1920, height: 1080 },
      { width: 1366, height: 768 },
      { width: 1440, height: 900 },
      { width: 1280, height: 800 },
      { width: 1536, height: 864 },
    ];
    return viewports[Math.floor(Math.random() * viewports.length)];
  }

  private randomUserAgent(): string {
    const agents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
    ];
    return agents[Math.floor(Math.random() * agents.length)];
  }
}
