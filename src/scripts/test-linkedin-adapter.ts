import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisService } from '../database/redis.service';
import type { AdapterConfig } from '../common/interfaces/adapter.interface';
import type { RawLeadInput } from '../common/interfaces/lead-input.interface';
import type { LinkedInAdapterConfig, LinkedInSearchFilters, LinkedInPostFilters } from '../adapters/linkedin/linkedin-adapter.config';
import { LINKEDIN_SELECTORS } from '../adapters/linkedin/linkedin-selectors.config';
import type { DomAuditResult } from '../adapters/linkedin/linkedin-diagnostics.service';

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

  async del(key: string): Promise<void> {
    this.store.delete(key);
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
  diagnose: boolean;
  outputFile?: string;
  searchFilters: LinkedInSearchFilters;
  postFilters: LinkedInPostFilters;
}

function parseArgs(argv: string[]): CliOptions {
  const keywords: string[] = [];
  const headlineKeywords: string[] = [];
  let organizationId = 'linkedin-live-test';
  let campaignId: string | undefined;
  let maxResults = 10;
  let json = false;
  let diagnose = false;
  let outputFile: string | undefined;
  const searchFilters: LinkedInSearchFilters = {};
  const postFilters: LinkedInPostFilters = {};

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];

    if (arg === '--keyword' || arg === '-k') {
      const value = argv[index + 1];
      if (!value) throw new Error('Missing value for --keyword');
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
      if (!value) throw new Error('Missing value for --organization');
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
      if (!value) throw new Error('Missing value for --campaign');
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
      if (!value) throw new Error('Missing value for --max-results');
      maxResults = parsePositiveInt(value, '--max-results');
      index++;
      continue;
    }
    if (arg.startsWith('--max-results=')) {
      maxResults = parsePositiveInt(arg.slice('--max-results='.length), '--max-results');
      continue;
    }

    if (arg === '--json') { json = true; continue; }
    if (arg === '--diagnose' || arg === '--diagnose-only') { diagnose = true; continue; }

    if (arg === '--output-file') {
      const value = argv[index + 1];
      if (!value) throw new Error('Missing value for --output-file');
      outputFile = value;
      index++;
      continue;
    }
    if (arg.startsWith('--output-file=')) {
      outputFile = arg.slice('--output-file='.length);
      continue;
    }

    // ── Search URL filters ────────────────────────────────────────────────────
    if (arg === '--date-posted') {
      const value = argv[index + 1] as LinkedInSearchFilters['datePosted'];
      if (!value) throw new Error('Missing value for --date-posted');
      searchFilters.datePosted = value;
      index++;
      continue;
    }
    if (arg.startsWith('--date-posted=')) {
      searchFilters.datePosted = arg.slice('--date-posted='.length) as LinkedInSearchFilters['datePosted'];
      continue;
    }

    if (arg === '--network') {
      const value = argv[index + 1];
      if (!value) throw new Error('Missing value for --network');
      searchFilters.network = value.split(',').map((s) => s.trim()) as Array<'F' | 'S' | 'O'>;
      index++;
      continue;
    }
    if (arg.startsWith('--network=')) {
      searchFilters.network = arg.slice('--network='.length).split(',').map((s) => s.trim()) as Array<'F' | 'S' | 'O'>;
      continue;
    }

    if (arg === '--content-type') {
      const value = argv[index + 1] as LinkedInSearchFilters['contentType'];
      if (!value) throw new Error('Missing value for --content-type');
      searchFilters.contentType = value;
      index++;
      continue;
    }
    if (arg.startsWith('--content-type=')) {
      searchFilters.contentType = arg.slice('--content-type='.length) as LinkedInSearchFilters['contentType'];
      continue;
    }

    // ── Post quality filters ──────────────────────────────────────────────────
    if (arg === '--min-content') {
      const value = argv[index + 1];
      if (!value) throw new Error('Missing value for --min-content');
      postFilters.minContentLength = parsePositiveInt(value, '--min-content');
      index++;
      continue;
    }
    if (arg.startsWith('--min-content=')) {
      postFilters.minContentLength = parsePositiveInt(arg.slice('--min-content='.length), '--min-content');
      continue;
    }

    if (arg === '--headline-keyword') {
      const value = argv[index + 1];
      if (!value) throw new Error('Missing value for --headline-keyword');
      headlineKeywords.push(value);
      index++;
      continue;
    }
    if (arg.startsWith('--headline-keyword=')) {
      headlineKeywords.push(arg.slice('--headline-keyword='.length));
      continue;
    }

    if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (headlineKeywords.length > 0) {
    postFilters.headlineKeywords = headlineKeywords;
  }

  if (keywords.length === 0) {
    const envKeywords = process.env.LINKEDIN_TEST_KEYWORDS?.split(',')
      .map((keyword) => keyword.trim())
      .filter(Boolean);
    if (envKeywords?.length) keywords.push(...envKeywords);
  }

  if (keywords.length === 0) {
    throw new Error('At least one keyword is required. Use --keyword or LINKEDIN_TEST_KEYWORDS.');
  }

  return { keywords, organizationId, campaignId, maxResults, json, diagnose, outputFile, searchFilters, postFilters };
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
  --keyword, -k           Repeatable keyword to search on LinkedIn content
  --max-results           Maximum total leads to stream across all keywords (default: 10)
  --organization          Organization id used in adapter config
  --campaign              Campaign id stored in lead metadata
  --json                  Print each lead as JSON only (suppresses human-readable output)
  --diagnose              Run DOM selector audit only — no lead collection
  --output-file <path>    Write collected leads to a JSON file (path or directory)

Search URL filters (passed to LinkedIn):
  --date-posted <val>     Filter by post date: past-24h | past-week | past-month
  --network <degrees>     Connection degrees: F,S or F,S,O (comma-separated)
  --content-type <val>    Content type: posts | articles

Post quality filters (applied after extraction):
  --min-content <n>       Minimum post content length in characters (default: 10)
  --headline-keyword <kw> Require keyword in author's headline (repeatable)

  --help, -h              Show this help text
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
  console.log(`profile:  ${lead.sourceUrl ?? ''}`);
  console.log(`keyword:  ${String(lead.metadata?.['keyword'] ?? '')}`);
  console.log(`posted:   ${String(lead.metadata?.['postedAt'] ?? '')}`);
  console.log(`content:  ${(lead.originalContent ?? '').slice(0, 200)}${(lead.originalContent?.length ?? 0) > 200 ? '...' : ''}`);
}

function renderDiagnoseTable(audit: DomAuditResult): void {
  const pass = (active: string | null) => (active ? '✓' : '✗');
  const fmt = (label: string, group: { active: string | null; counts: Record<string, number> }) => {
    const status = pass(group.active);
    const activeInfo = group.active ? `${group.active} — ${group.counts[group.active]} elements` : 'NO MATCH';
    return `  ${status}  ${label.padEnd(18)} ${activeInfo}`;
  };

  const broken = [
    audit.postContainers,
    audit.authorName,
    audit.authorLink,
    audit.content,
    audit.headline,
    audit.postedAt,
  ].filter((g) => g.active === null);

  console.log('');
  console.log(`  Selector version : v${audit.selectorVersion} (last verified ${LINKEDIN_SELECTORS.lastVerified})`);
  console.log(`  Cards found      : ${audit.totalCards}`);
  console.log(`  URL              : ${audit.url}`);
  console.log('');
  console.log(fmt('POST CONTAINERS', audit.postContainers));
  console.log(fmt('AUTHOR NAME', audit.authorName));
  console.log(fmt('AUTHOR LINK', audit.authorLink));
  console.log(fmt('CONTENT', audit.content));
  console.log(fmt('HEADLINE', audit.headline));
  console.log(fmt('POSTED-AT', audit.postedAt));
  console.log('');

  if (broken.length === 0) {
    console.log('  RESULT: All selector groups resolved — adapter should extract posts correctly.');
  } else {
    console.log(`  RESULT: ${broken.length} selector group(s) returned 0 matches.`);
    console.log('  Run npm run linkedin:dump-dom to capture full HTML and fix selectors.');
  }
  console.log('');
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  const [
    { LinkedInAdapter },
    { LinkedInProxyService },
    { LinkedInSessionService },
    { LinkedInStealthService },
    { LinkedInDiagnosticsService },
    { LinkedInSearchService },
    { LinkedInExtractionService },
    { LinkedInRunSummaryService },
  ] = await Promise.all([
    import('../adapters/linkedin/linkedin.adapter'),
    import('../adapters/linkedin/linkedin-proxy.service'),
    import('../adapters/linkedin/linkedin-session.service'),
    import('../adapters/linkedin/linkedin-stealth.service'),
    import('../adapters/linkedin/linkedin-diagnostics.service'),
    import('../adapters/linkedin/linkedin-search.service'),
    import('../adapters/linkedin/linkedin-extraction.service'),
    import('../adapters/linkedin/linkedin-run-summary.service'),
  ]);

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
      LinkedInSearchService,
      LinkedInExtractionService,
      LinkedInRunSummaryService,
      LinkedInAdapter,
      { provide: RedisService, useClass: InMemoryRedisService },
    ],
  })
  class LinkedInAdapterTestModule {}

  const headlessMode = process.env.LINKEDIN_HEADLESS ?? 'true';
  console.log('Starting LinkedIn adapter test');
  console.log(`keywords:  ${options.keywords.join(', ')}`);
  console.log(`headless:  ${headlessMode}`);
  if (options.diagnose) {
    console.log('mode:      diagnose-only (no lead collection)');
  } else {
    console.log(`maxResults: ${options.maxResults}`);
    if (options.searchFilters.datePosted) console.log(`datePosted: ${options.searchFilters.datePosted}`);
    if (options.searchFilters.network) console.log(`network:    ${options.searchFilters.network.join(',')}`);
    if (options.postFilters.headlineKeywords) console.log(`headlineKw: ${options.postFilters.headlineKeywords.join(', ')}`);
    if (options.postFilters.minContentLength) console.log(`minContent: ${options.postFilters.minContentLength}`);
    if (options.outputFile) console.log(`outputFile: ${options.outputFile}`);
  }

  const app = await NestFactory.createApplicationContext(LinkedInAdapterTestModule, {
    logger: ['log', 'warn', 'error'],
  });

  const configService = app.get(ConfigService);
  const adapter = app.get(LinkedInAdapter);
  const linkedinEmail = configService.get<string>('LINKEDIN_EMAIL');
  const linkedinPassword = configService.get<string>('LINKEDIN_PASSWORD');

  let shuttingDown = false;
  const shutdown = async (exitCode = 0): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
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

    // ── Diagnose mode ─────────────────────────────────────────────────────────
    if (options.diagnose) {
      console.log('\nLinkedIn Adapter Diagnose Mode');
      console.log(`keyword: ${options.keywords[0]}`);
      console.log('Logging in and navigating to search page...\n');

      const sessionService = app.get(LinkedInSessionService);
      const searchService = app.get(LinkedInSearchService);
      const diagnosticsService = app.get(LinkedInDiagnosticsService);

      const page = await sessionService.getAuthenticatedPage();
      try {
        await searchService.navigateToSearch(
          page,
          options.keywords[0],
          options.searchFilters,
          options.organizationId,
        );
        // Shallow scroll — just enough to trigger first batch of cards
        await searchService.scroll(page, 2);

        const audit = await diagnosticsService.logSearchDiagnostics(page, {
          phase: 'diagnose',
          keyword: options.keywords[0],
          organizationId: options.organizationId,
        });

        if (!audit) {
          console.error('Selector audit returned null — the page may not have loaded correctly.');
          await shutdown(1);
          return;
        }

        renderDiagnoseTable(audit);

        const hasBroken = [
          audit.postContainers,
          audit.authorName,
          audit.authorLink,
          audit.content,
          audit.headline,
          audit.postedAt,
        ].some((g) => g.active === null);

        await shutdown(hasBroken ? 1 : 0);
      } finally {
        await (page as any).close().catch(() => {});
      }
      return;
    }

    // ── Normal collect mode ───────────────────────────────────────────────────
    const healthy = await adapter.isHealthy();
    console.log(`\nlinkedin reachable: ${healthy}`);

    const config: AdapterConfig & LinkedInAdapterConfig = {
      organizationId: options.organizationId,
      campaignId: options.campaignId,
      keywords: options.keywords,
      maxResults: options.maxResults,
      searchFilters: options.searchFilters,
      postFilters: options.postFilters,
      outputFile: options.outputFile,
    };

    let count = 0;
    for await (const lead of adapter.collect(config)) {
      count++;
      printLead(lead, count, options.json);
    }

    console.log(`\nCompleted: ${count} lead(s) collected.`);
    await shutdown(0);
  } catch (error) {
    console.error(
      `LinkedIn adapter test failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    await shutdown(1);
  }
}

void main();
