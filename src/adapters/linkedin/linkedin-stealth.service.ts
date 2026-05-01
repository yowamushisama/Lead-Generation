// Re-export from the shared PlaywrightStealthService under the legacy name
// so all existing LinkedIn imports continue to work without change.
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlaywrightStealthService } from '../shared/playwright-stealth.service';
import type { BrowserContext, Page } from 'playwright';

export { PlaywrightStealthService };

@Injectable()
export class LinkedInStealthService implements OnModuleDestroy {
  private readonly delegate: PlaywrightStealthService;

  constructor(private readonly configService: ConfigService) {
    this.delegate = new PlaywrightStealthService(configService);
  }

  async getPersistentContext(): Promise<BrowserContext> {
    return this.delegate.getPersistentContext('linkedin');
  }

  async newPage(): Promise<Page> {
    return this.delegate.newPage('linkedin');
  }

  async onModuleDestroy(): Promise<void> {
    return this.delegate.onModuleDestroy();
  }

  randomDelayMs(min = 500, max = 2000): number {
    return this.delegate.randomDelayMs(min, max);
  }
}
