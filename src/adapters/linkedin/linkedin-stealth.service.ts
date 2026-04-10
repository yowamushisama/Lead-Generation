import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { chromium } from 'playwright-extra';
import type { Browser, BrowserContext, Page } from 'playwright';

type StealthPluginFactory = () => unknown;
type ChromiumPlugin = Parameters<typeof chromium.use>[0];

const stealthPluginModule = require('puppeteer-extra-plugin-stealth') as
  | StealthPluginFactory
  | { default?: StealthPluginFactory };
const createStealthPlugin =
  typeof stealthPluginModule === 'function'
    ? stealthPluginModule
    : stealthPluginModule.default;

if (typeof createStealthPlugin !== 'function') {
  throw new Error('Failed to load puppeteer-extra-plugin-stealth');
}

// Apply stealth plugin globally once
chromium.use(createStealthPlugin() as ChromiumPlugin);

export interface ProxyConfig {
  server: string;
  username?: string;
  password?: string;
  raw: string;
}

@Injectable()
export class LinkedInStealthService {
  private readonly logger = new Logger(LinkedInStealthService.name);
  private browser: Browser | null = null;

  constructor(private readonly configService: ConfigService) {}

  async newPage(proxyConfig?: ProxyConfig): Promise<Page> {
    const headless =
      this.configService.get<string>('LINKEDIN_HEADLESS', 'true') !== 'false';

    // Always close and recreate the browser when a proxy is provided so that
    // proxy rotation actually takes effect (the proxy is bound at launch time).
    if (this.browser) {
      await (this.browser as any).close();
      this.browser = null;
    }

    const launchArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--disable-dev-shm-usage',
    ];

    const launchOptions: Record<string, unknown> = { headless, args: launchArgs };

    if (proxyConfig) {
      // Proxy credentials must be supplied at launch time, not via
      // httpCredentials (which is for site-level Basic Auth, not proxy auth).
      launchOptions['proxy'] = {
        server: proxyConfig.server,
        ...(proxyConfig.username ? { username: proxyConfig.username } : {}),
        ...(proxyConfig.password ? { password: proxyConfig.password } : {}),
      };
    }

    this.browser = await (chromium as any).launch(launchOptions);

    const contextOptions: Record<string, unknown> = {
      viewport: this.randomViewport(),
      userAgent: this.randomUserAgent(),
      locale: 'en-US',
      timezoneId: 'America/New_York',
      extraHTTPHeaders: {
        'accept-language': 'en-US,en;q=0.9',
        'accept-encoding': 'gzip, deflate, br',
      },
    };

    const context: BrowserContext = await (this.browser as any).newContext(contextOptions);

    // Mask webdriver flag and other automation signals
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
      Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
      Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] });
      // @ts-ignore
      window.chrome = { runtime: {} };
    });

    const page = await context.newPage();

    this.logger.log({ message: 'New stealth page created', proxy: proxyConfig?.server ?? 'none' });
    return page;
  }

  async closeBrowser(): Promise<void> {
    if (this.browser) {
      await (this.browser as any).close();
      this.browser = null;
      this.logger.log({ message: 'Browser closed' });
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
