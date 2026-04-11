import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisService } from '../database/redis.service';
import type { AdapterConfig } from '../common/interfaces/adapter.interface';
import type { RawLeadInput } from '../common/interfaces/lead-input.interface';

class InMemoryRedisService {
  private readonly store = new Map<string, { value: string; expiresAt?: number }>();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) {
      return null;
    }

    if (entry.expiresAt && entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }

    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : undefined,
    });
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    const entry = this.store.get(key);
    if (!entry) {
      return;
    }

    entry.expiresAt = Date.now() + ttlSeconds * 1000;
    this.store.set(key, entry);
  }
}

interface CliOptions {
  keywords: string[];
  organizationId: string;
  campaignId?: string;
  maxResults: number;
  json: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  const keywords: string[] = [];
  let organizationId = 'linkedin-live-test';
  let campaignId: string | undefined;
  let maxResults = 10;
  let json = false;

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];

    if (arg === '--keyword' || arg === '-k') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Missing value for --keyword');
      }
      keywords.push(value);
      index++;
      continue;
    }

    if (arg.startsWith('--keyword=')) {
      keywords.push(arg.slice('--keyword='.length));
      continue;
    }

    if (arg === '--organization' || arg === '--organizationId') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Missing value for --organization');
      }
      organizationId = value;
      index++;
      continue;
    }

    if (arg.startsWith('--organization=')) {
      organizationId = arg.slice('--organization='.length);
      continue;
    }

    if (arg === '--campaign' || arg === '--campaignId') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Missing value for --campaign');
      }
      campaignId = value;
      index++;
      continue;
    }

    if (arg.startsWith('--campaign=')) {
      campaignId = arg.slice('--campaign='.length);
      continue;
    }

    if (arg === '--max-results' || arg === '--maxResults') {
      const value = argv[index + 1];
      if (!value) {
        throw new Error('Missing value for --max-results');
      }
      maxResults = parsePositiveInt(value, '--max-results');
      index++;
      continue;
    }

    if (arg.startsWith('--max-results=')) {
      maxResults = parsePositiveInt(arg.slice('--max-results='.length), '--max-results');
      continue;
    }

    if (arg === '--json') {
      json = true;
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (keywords.length === 0) {
    const envKeywords = process.env.LINKEDIN_TEST_KEYWORDS?.split(',')
      .map((keyword) => keyword.trim())
      .filter(Boolean);

    if (envKeywords?.length) {
      keywords.push(...envKeywords);
    }
  }

  if (keywords.length === 0) {
    throw new Error('At least one keyword is required. Use --keyword or LINKEDIN_TEST_KEYWORDS.');
  }

  return {
    keywords,
    organizationId,
    campaignId,
    maxResults,
    json,
  };
}

function parsePositiveInt(value: string, flagName: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${flagName} must be a positive integer`);
  }
  return parsed;
}

function printUsage(): void {
  console.log(
    `
Usage:
  npm run linkedin:test-live -- --keyword "hiring SDR" --keyword "b2b saas" --max-results 5

Required env vars:
  LINKEDIN_EMAIL
  LINKEDIN_PASSWORD

Optional env vars:
  LINKEDIN_HEADLESS=false
  LINKEDIN_PROXY_LIST=host:port[:username:password],host:port[:username:password]
  LINKEDIN_TEST_KEYWORDS=keyword one,keyword two

Options:
  --keyword, -k       Repeatable keyword to search on LinkedIn content
  --max-results       Maximum total leads to stream across all keywords
  --organization      Organization id used in adapter config
  --campaign          Campaign id stored in lead metadata
  --json              Print each lead as JSON only
  --help, -h          Show this help text
`.trim(),
  );
}

function printLead(lead: RawLeadInput, index: number, jsonOnly: boolean): void {
  if (jsonOnly) {
    console.log(JSON.stringify({ index, lead }, null, 2));
    return;
  }

  console.log(`\n[lead ${index}] ${lead.name}`);
  console.log(`headline: ${lead.headline ?? ''}`);
  console.log(`profile: ${lead.sourceUrl ?? ''}`);
  console.log(`keyword: ${String(lead.metadata?.['keyword'] ?? '')}`);
  console.log(`postedAt: ${String(lead.metadata?.['postedAt'] ?? '')}`);
  console.log(`content: ${lead.originalContent ?? ''}`);
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  const [
    { LinkedInAdapter },
    { LinkedInProxyService },
    { LinkedInSessionService },
    { LinkedInStealthService },
  ] = await Promise.all([
    import('../adapters/linkedin/linkedin.adapter'),
    import('../adapters/linkedin/linkedin-proxy.service'),
    import('../adapters/linkedin/linkedin-session.service'),
    import('../adapters/linkedin/linkedin-stealth.service'),
  ]);
  const { LinkedInDiagnosticsService } =
    await import('../adapters/linkedin/linkedin-diagnostics.service');

  @Module({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        envFilePath: ['.env.local', '.env'],
        cache: true,
      }),
    ],
    providers: [
      LinkedInStealthService,
      LinkedInProxyService,
      LinkedInSessionService,
      LinkedInDiagnosticsService,
      LinkedInAdapter,
      { provide: RedisService, useClass: InMemoryRedisService },
    ],
  })
  class LinkedInAdapterTestModule {}

  console.log('Starting live LinkedIn adapter test');
  console.log(`keywords: ${options.keywords.join(', ')}`);
  console.log(`maxResults: ${options.maxResults}`);
  console.log(`headless: ${process.env.LINKEDIN_HEADLESS ?? 'true'}`);

  const app = await NestFactory.createApplicationContext(LinkedInAdapterTestModule, {
    logger: ['log', 'warn', 'error'],
  });

  const configService = app.get(ConfigService);
  const stealthService = app.get(LinkedInStealthService);
  const adapter = app.get(LinkedInAdapter);
  const linkedinEmail = configService.get<string>('LINKEDIN_EMAIL');
  const linkedinPassword = configService.get<string>('LINKEDIN_PASSWORD');

  let shuttingDown = false;
  const shutdown = async (exitCode = 0): Promise<void> => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    await stealthService.closeBrowser().catch(() => undefined);
    await app.close().catch(() => undefined);
    process.exit(exitCode);
  };

  process.on('SIGINT', () => {
    console.log('\nInterrupted, closing browser...');
    void shutdown(130);
  });

  process.on('SIGTERM', () => {
    console.log('\nTermination requested, closing browser...');
    void shutdown(143);
  });

  try {
    if (!linkedinEmail || !linkedinPassword) {
      throw new Error(
        'LINKEDIN_EMAIL and LINKEDIN_PASSWORD must be set in .env.local, .env, or the shell environment',
      );
    }

    const healthy = await adapter.isHealthy();
    console.log(`linkedin reachable: ${healthy}`);

    const config: AdapterConfig = {
      organizationId: options.organizationId,
      campaignId: options.campaignId,
      keywords: options.keywords,
      maxResults: options.maxResults,
    };

    let count = 0;
    for await (const lead of adapter.collect(config)) {
      count++;
      printLead(lead, count, options.json);
    }

    console.log(`\nCompleted live LinkedIn adapter test with ${count} lead(s).`);
    await shutdown(0);
  } catch (error) {
    console.error(
      `LinkedIn adapter test failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    await shutdown(1);
  }
}

void main();
