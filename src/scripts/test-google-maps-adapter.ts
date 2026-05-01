import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import type { AdapterConfig } from '../common/interfaces/adapter.interface';
import type { RawLeadInput } from '../common/interfaces/lead-input.interface';
import { GmapsAdapterConfig } from '../adapters/google-maps/gmaps-adapter.config';

interface CliOptions {
  industries: string[];
  locations: string[];
  organizationId: string;
  campaignId?: string;
  maxResults: number;
  json: boolean;
  fetchDetails: boolean;
  scrollSteps: number;
  auditWebsites: boolean;
}

/** Strip Windows CMD caret escapes that npm injects on Windows */
function cleanArg(s: string): string {
  return s.replace(/\^/g, '').trim();
}

function parseArgs(argv: string[]): CliOptions {
  // Strip Windows CMD caret escapes from every argument up-front
  const args = argv.map(cleanArg);

  const industries: string[] = [];
  const locations: string[] = [];
  let organizationId = 'gmaps-live-test';
  let campaignId: string | undefined;
  let maxResults = 10;
  let json = false;
  let fetchDetails = true;
  let scrollSteps = 8;
  let auditWebsites = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--industry' || arg === '-i') { industries.push(args[++i]); continue; }
    if (arg.startsWith('--industry=')) { industries.push(arg.slice('--industry='.length)); continue; }
    if (arg === '--industries') { industries.push(...args[++i].split(',').map((s) => s.trim()).filter(Boolean)); continue; }

    if (arg === '--location' || arg === '-l') { locations.push(args[++i]); continue; }
    if (arg.startsWith('--location=')) { locations.push(arg.slice('--location='.length)); continue; }
    // --locations consumes all remaining tokens until the next --flag, joining with space
    // This handles: --locations "Austin, TX" split by Windows CMD into two args
    if (arg === '--locations') {
      const parts: string[] = [];
      while (i + 1 < args.length && !args[i + 1].startsWith('--')) {
        parts.push(args[++i]);
      }
      // Split the joined string on comma to support multiple locations
      const joined = parts.join(' ');
      locations.push(...joined.split(',').map((s) => s.trim()).filter(Boolean));
      continue;
    }

    if (arg === '--org' || arg === '--organizationId') { organizationId = args[++i]; continue; }
    if (arg === '--campaign' || arg === '--campaignId') { campaignId = args[++i]; continue; }
    if (arg === '--max' || arg === '--max-results') { maxResults = parseInt(args[++i], 10); continue; }
    if (arg === '--scroll-steps') { scrollSteps = parseInt(args[++i], 10); continue; }
    if (arg === '--json') { json = true; continue; }
    if (arg === '--no-details') { fetchDetails = false; continue; }
    if (arg === '--audit-websites') { auditWebsites = true; continue; }
    if (arg === '--help' || arg === '-h') { printUsage(); process.exit(0); }
  }

  if (industries.length === 0) {
    const env = process.env.GMAPS_TEST_INDUSTRIES?.split(',').map((s) => s.trim()).filter(Boolean);
    if (env?.length) industries.push(...env);
  }
  if (locations.length === 0) {
    const env = process.env.GMAPS_TEST_LOCATIONS?.split(',').map((s) => s.trim()).filter(Boolean);
    if (env?.length) locations.push(...env);
  }

  if (industries.length === 0) throw new Error('At least one industry required. Use --industries or GMAPS_TEST_INDUSTRIES.');
  if (locations.length === 0) throw new Error('At least one location required. Use --locations or GMAPS_TEST_LOCATIONS.');

  return { industries, locations, organizationId, campaignId, maxResults, json, fetchDetails, scrollSteps, auditWebsites };
}

function printUsage(): void {
  console.log(`
Usage:
  npm run gmaps:test-live -- --industries plumber --locations "Austin TX" --max 10

Required:
  --industries <csv>     Niche/industry to search (comma-separated or repeatable --industry)
  --locations <text>     Location to search in — use spaces instead of commas on Windows
                         e.g. "Austin TX" not "Austin, TX"

Options:
  --max <n>             Maximum leads to collect (default: 10)
  --scroll-steps <n>    Scroll passes per query (default: 8)
  --no-details          Skip clicking into each listing (faster, fewer fields)
  --audit-websites      Run website enricher on each lead after scraping
  --json                Print each lead as raw JSON
  --org <id>            Organization ID for the adapter config
  --campaign <id>       Campaign ID stored in lead metadata
  --help, -h            Show this help
`.trim());
}

function printLead(lead: RawLeadInput, index: number, jsonOnly: boolean, audit?: Record<string, unknown>): void {
  if (jsonOnly) { console.log(JSON.stringify({ index, lead, audit: audit ?? null }, null, 2)); return; }
  const m = lead.metadata as Record<string, unknown> ?? {};
  console.log(`\n[lead ${index}] ${lead.name}`);
  console.log(`  website:     ${lead.website ?? '(none)'}`);
  console.log(`  phone:       ${lead.phone ?? '(none)'}`);
  console.log(`  location:    ${lead.location ?? ''}`);
  console.log(`  rating:      ${m['rating'] ?? ''}`);
  console.log(`  reviews:     ${m['reviewCount'] ?? ''}`);
  console.log(`  types:       ${JSON.stringify(m['googleTypes'] ?? [])}`);
  console.log(`  lastReview:  ${m['lastReviewAt'] ?? ''}`);
  console.log(`  social:      ${JSON.stringify(m['socialHandlesFromGmaps'] ?? {})}`);
  if (audit) {
    console.log(`  ── website audit ──`);
    console.log(`  status:      ${audit['enrichmentStatus']}`);
    if (audit['websiteAudit']) {
      const a = audit['websiteAudit'] as Record<string, unknown>;
      console.log(`  title:       ${a['title'] ?? '(none)'}`);
      console.log(`  metaDesc:    ${a['metaDescription'] ? 'yes' : 'missing'}`);
      console.log(`  cta:         ${a['ctaPresent'] ? 'yes' : 'no'}`);
      console.log(`  loadMs:      ${a['loadMs']}ms`);
      console.log(`  techStack:   ${JSON.stringify(a['techStack'] ?? [])}`);
    }
    if (audit['socialHandles']) {
      const s = audit['socialHandles'] as Record<string, unknown>;
      const found = Object.entries(s).filter(([, v]) => v).map(([k]) => k);
      if (found.length) console.log(`  webSocial:   ${found.join(', ')}`);
    }
  }
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  const [
    { GoogleMapsAdapter },
    { GmapsSearchService },
    { GmapsExtractionService },
    { PlaywrightStealthService },
    { WebsiteEnricherStage },
  ] = await Promise.all([
    import('../adapters/google-maps/google-maps.adapter'),
    import('../adapters/google-maps/gmaps-search.service'),
    import('../adapters/google-maps/gmaps-extraction.service'),
    import('../adapters/shared/playwright-stealth.service'),
    import('../pipeline/stages/website-enricher.stage'),
  ]);

  const providers: unknown[] = [PlaywrightStealthService, GmapsSearchService, GmapsExtractionService, GoogleMapsAdapter];
  if (options.auditWebsites) providers.push(WebsiteEnricherStage);

  @Module({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env.local', '.env'], cache: true }),
    ],
    providers: providers as never[],
  })
  class GmapsTestModule {}

  console.log('Starting Google Maps adapter test');
  console.log(`industries:     ${options.industries.join(', ')}`);
  console.log(`locations:      ${options.locations.join(', ')}`);
  console.log(`maxResults:     ${options.maxResults}`);
  console.log(`details:        ${options.fetchDetails}`);
  console.log(`auditWebsites:  ${options.auditWebsites}`);

  const app = await NestFactory.createApplicationContext(GmapsTestModule, {
    logger: ['log', 'warn', 'error'],
  });

  const adapter = app.get(GoogleMapsAdapter);
  const enricher = options.auditWebsites ? app.get(WebsiteEnricherStage) : null;

  let shuttingDown = false;
  const shutdown = async (code = 0): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    await app.close().catch(() => {});
    process.exit(code);
  };

  process.on('SIGINT', () => { console.log('\nInterrupted'); void shutdown(130); });
  process.on('SIGTERM', () => { console.log('\nTerminated'); void shutdown(143); });

  try {
    const healthy = await adapter.isHealthy();
    console.log(`\ngoogle.com/maps reachable: ${healthy}`);

    const config: AdapterConfig & GmapsAdapterConfig = {
      organizationId: options.organizationId,
      campaignId: options.campaignId,
      industries: options.industries,
      locations: options.locations,
      maxResults: options.maxResults,
      scrollSteps: options.scrollSteps,
      fetchDetails: options.fetchDetails,
    };

    let count = 0;
    for await (const lead of adapter.collect(config)) {
      count++;

      let audit: Record<string, unknown> | undefined;
      if (enricher && lead.website) {
        process.stdout.write(`  [auditing ${lead.website}...] `);
        const result = await enricher.process(lead.website).catch((e: unknown) => {
          process.stdout.write('failed\n');
          console.error(e instanceof Error ? e.message : String(e));
          return null;
        });
        if (result) {
          process.stdout.write(`${result.enrichmentStatus}\n`);
          audit = result as unknown as Record<string, unknown>;
        }
      }

      printLead(lead, count, options.json, audit);
    }

    console.log(`\nCompleted: ${count} lead(s) collected.`);
    await shutdown(0);
  } catch (err) {
    console.error(`Test failed: ${err instanceof Error ? err.message : String(err)}`);
    await shutdown(1);
  }
}

void main();
