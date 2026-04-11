import { registerAs } from '@nestjs/config';

export interface ScrapingConfig {
  concurrentLimit: number;
  delayMs: number;
  timeoutMs: number;
  retryAttempts: number;
  retryBackoffMs: number;
  userAgent: string;
  // LinkedIn session / stealth
  linkedinEmail: string | undefined;
  linkedinPassword: string | undefined;
  linkedinHeadless: boolean;
  linkedinProxyList: string | undefined;
  linkedinSessionTtlMs: number;
  // Google Maps
  googleMapsApiKey: string | undefined;
}

export default registerAs(
  'scraping',
  (): ScrapingConfig => ({
    concurrentLimit: parseInt(process.env['SCRAPING_CONCURRENT_LIMIT'] ?? '5', 10),
    delayMs: parseInt(process.env['SCRAPING_DELAY_MS'] ?? '1000', 10),
    timeoutMs: parseInt(process.env['SCRAPING_TIMEOUT_MS'] ?? '30000', 10),
    retryAttempts: parseInt(process.env['SCRAPING_RETRY_ATTEMPTS'] ?? '3', 10),
    retryBackoffMs: 2000,
    userAgent: 'Mozilla/5.0 (compatible; LeadGenerationBot/1.0; +https://yourdomain.com/bot)',
    linkedinEmail: process.env['LINKEDIN_EMAIL'],
    linkedinPassword: process.env['LINKEDIN_PASSWORD'],
    linkedinHeadless: process.env['LINKEDIN_HEADLESS'] !== 'false',
    linkedinProxyList: process.env['LINKEDIN_PROXY_LIST'],
    linkedinSessionTtlMs: 12 * 60 * 60 * 1000, // 12 hours
    googleMapsApiKey: process.env['GOOGLE_MAPS_API_KEY'],
  }),
);
