import { registerAs } from '@nestjs/config';

export interface ScrapingConfig {
  concurrentLimit: number;
  delayMs: number;
  timeoutMs: number;
  retryAttempts: number;
  retryBackoffMs: number;
  userAgent: string;
}

export default registerAs(
  'scraping',
  (): ScrapingConfig => ({
    concurrentLimit: parseInt(process.env['SCRAPING_CONCURRENT_LIMIT'] ?? '5', 10),
    delayMs: parseInt(process.env['SCRAPING_DELAY_MS'] ?? '1000', 10),
    timeoutMs: parseInt(process.env['SCRAPING_TIMEOUT_MS'] ?? '30000', 10),
    retryAttempts: parseInt(process.env['SCRAPING_RETRY_ATTEMPTS'] ?? '3', 10),
    retryBackoffMs: 2000,
    userAgent:
      'Mozilla/5.0 (compatible; LeadGenerationBot/1.0; +https://yourdomain.com/bot)',
  }),
);
