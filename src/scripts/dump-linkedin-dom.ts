/**
 * LinkedIn DOM Dumper
 *
 * Logs in to LinkedIn, navigates to a content-search page, runs a full
 * selector audit and saves three files to linkedin-dom-dumps/:
 *
 *   <timestamp>_<keyword>_report.txt  — selector audit + instructions (paste into Claude Code)
 *   <timestamp>_<keyword>_cards.html  — outer HTML of the first 5 cards
 *   <timestamp>_<keyword>_full.html   — full page HTML
 *
 * Usage:
 *   npm run linkedin:dump-dom -- --keyword "hiring SDR"
 *   npm run linkedin:dump-dom -- --keyword "b2b saas hiring" --max-cards 10
 */

import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RedisService } from '../database/redis.service';
import { LinkedInStealthService } from '../adapters/linkedin/linkedin-stealth.service';
import { LinkedInProxyService } from '../adapters/linkedin/linkedin-proxy.service';
import { LinkedInSessionService } from '../adapters/linkedin/linkedin-session.service';
import {
  LinkedInDiagnosticsService,
  DomAuditResult,
} from '../adapters/linkedin/linkedin-diagnostics.service';
import { LINKEDIN_SELECTORS } from '../adapters/linkedin/linkedin-selectors.config';
import type { Page } from 'playwright';

// ── Minimal in-memory Redis so we don't need a live Redis instance ──────────

class InMemoryRedisService {
  private readonly store = new Map<string, { value: string; expiresAt?: number }>();

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string): Promise<void> {
    this.store.set(key, { value });
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    const entry = this.store.get(key);
    if (entry) entry.expiresAt = Date.now() + ttlSeconds * 1000;
  }
}

// ── CLI argument parsing ─────────────────────────────────────────────────────

interface CliOptions {
  keyword: string;
  maxCards: number;
  outputDir: string;
}

function parseArgs(argv: string[]): CliOptions {
  let keyword = '';
  let maxCards = 5;
  let outputDir = 'linkedin-dom-dumps';

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if ((arg === '--keyword' || arg === '-k') && argv[i + 1]) {
      keyword = argv[++i];
    } else if (arg.startsWith('--keyword=')) {
      keyword = arg.slice('--keyword='.length);
    } else if (arg === '--max-cards' && argv[i + 1]) {
      maxCards = Math.max(1, parseInt(argv[++i], 10) || 5);
    } else if (arg.startsWith('--max-cards=')) {
      maxCards = Math.max(1, parseInt(arg.slice('--max-cards='.length), 10) || 5);
    } else if ((arg === '--output-dir' || arg === '-o') && argv[i + 1]) {
      outputDir = argv[++i];
    } else if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    }
  }

  if (!keyword) {
    // Try env fallback
    keyword = process.env.LINKEDIN_TEST_KEYWORDS?.split(',')[0]?.trim() ?? '';
  }

  if (!keyword) {
    console.error('Error: --keyword is required');
    printUsage();
    process.exit(1);
  }

  return { keyword, maxCards, outputDir };
}

function printUsage(): void {
  console.log(
    `
Usage:
  npm run linkedin:dump-dom -- --keyword "hiring SDR"
  npm run linkedin:dump-dom -- --keyword "b2b saas" --max-cards 10 --output-dir ./dumps

Options:
  --keyword, -k     Search keyword to navigate to (required)
  --max-cards       Number of card HTML snippets to save (default: 5)
  --output-dir, -o  Directory to write dump files (default: linkedin-dom-dumps)
  --help, -h        Show this help

Required env vars: LINKEDIN_EMAIL, LINKEDIN_PASSWORD
Optional env vars: LINKEDIN_HEADLESS=false
`.trim(),
  );
}

// ── Report generation ────────────────────────────────────────────────────────

function renderAuditReport(
  audit: DomAuditResult,
  keyword: string,
  cardHtmls: string[],
  timestamp: string,
  outputDir: string,
): string {
  const line = '─'.repeat(66);
  const pass = (n: number) => (n > 0 ? '✓' : '✗');

  function renderGroup(
    label: string,
    group: { active: string | null; counts: Record<string, number> },
  ): string {
    const rows = Object.entries(group.counts)
      .map(([sel, n]) => {
        const marker = sel === group.active ? ' ← ACTIVE' : '';
        return `  ${pass(n)} ${sel.padEnd(52)} ${String(n).padStart(3)} element(s)${marker}`;
      })
      .join('\n');
    return `${label}\n${rows}`;
  }

  const broken = [
    audit.postContainers,
    audit.authorName,
    audit.authorLink,
    audit.content,
    audit.headline,
    audit.postedAt,
  ].filter((g) => g.active === null);

  const statusLine =
    broken.length === 0
      ? '✓  All selector groups resolved'
      : `✗  ${broken.length} selector group(s) failed — update linkedin-selectors.config.ts`;

  const cardSection = cardHtmls
    .map((html, i) => {
      const urnMatch = html.match(/data-urn="([^"]+)"/);
      const urn = urnMatch ? urnMatch[1] : `card-${i + 1}`;
      return `[card ${i + 1}] ${urn}\n${'─'.repeat(60)}\n${html}\n`;
    })
    .join('\n');

  const baseName = `${timestamp}_${keyword.replace(/[^a-z0-9]+/gi, '-').slice(0, 40)}`;

  return [
    `╔${'═'.repeat(64)}╗`,
    `║${'  LINKEDIN DOM DUMP'.padEnd(63)}║`,
    `║${'  ' + timestamp}${''.padEnd(63 - 2 - timestamp.length)}║`,
    `╚${'═'.repeat(64)}╝`,
    '',
    `Keyword       : ${keyword}`,
    `URL           : ${audit.url}`,
    `Selector ver. : v${audit.selectorVersion} (last verified ${LINKEDIN_SELECTORS.lastVerified})`,
    `Cards found   : ${audit.totalCards}`,
    `Status        : ${statusLine}`,
    '',
    line,
    '  SELECTOR AUDIT',
    line,
    '',
    renderGroup('POST CONTAINERS', audit.postContainers),
    '',
    renderGroup('AUTHOR NAME', audit.authorName),
    '',
    renderGroup('AUTHOR LINK', audit.authorLink),
    '',
    renderGroup('CONTENT', audit.content),
    '',
    renderGroup('HEADLINE', audit.headline),
    '',
    renderGroup('POSTED-AT', audit.postedAt),
    '',
    line,
    '  AUTHOR LINKS FOUND IN FIRST CARD',
    line,
    '',
    audit.firstCardLinks.length > 0
      ? audit.firstCardLinks.map((l) => `  ${l}`).join('\n')
      : '  (none)',
    '',
    line,
    `  CARD HTML SNAPSHOTS (first ${cardHtmls.length})`,
    line,
    '',
    cardSection,
    line,
    '  OUTPUT FILES',
    line,
    '',
    `  ${path.join(outputDir, baseName + '_report.txt')}   ← this file`,
    `  ${path.join(outputDir, baseName + '_cards.html')}   ← paste into Claude Code`,
    `  ${path.join(outputDir, baseName + '_full.html')}    ← full page DOM`,
    '',
    line,
    '  HOW TO FIX BROKEN SELECTORS',
    line,
    '',
    '  1. Paste the contents of _cards.html (or this report) into Claude Code:',
    '       "Update LINKEDIN_SELECTORS in',
    '        src/adapters/linkedin/linkedin-selectors.config.ts',
    '        based on this HTML — keep the same interface shape."',
    '',
    '  2. Rebuild and test:',
    '       npm run build',
    `       npm run linkedin:test-live -- --keyword "${keyword}"`,
    '',
    '  3. If working, update lastVerified in linkedin-selectors.config.ts.',
    '',
  ].join('\n');
}

// ── NestJS module ────────────────────────────────────────────────────────────

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
    { provide: RedisService, useClass: InMemoryRedisService },
  ],
})
class DumperModule {}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  const app = await NestFactory.createApplicationContext(DumperModule, {
    logger: ['warn', 'error'],
  });

  const configService = app.get(ConfigService);
  const stealthService = app.get(LinkedInStealthService);
  const sessionService = app.get(LinkedInSessionService);
  const diagnostics = app.get(LinkedInDiagnosticsService);

  let shuttingDown = false;
  const shutdown = async (exitCode = 0): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    await app.close().catch(() => undefined);
    process.exit(exitCode);
  };

  process.on('SIGINT', () => {
    console.log('\nInterrupted.');
    void shutdown(130);
  });
  process.on('SIGTERM', () => {
    console.log('\nTerminated.');
    void shutdown(143);
  });

  try {
    const email = configService.get<string>('LINKEDIN_EMAIL');
    const password = configService.get<string>('LINKEDIN_PASSWORD');
    if (!email || !password) {
      throw new Error('LINKEDIN_EMAIL and LINKEDIN_PASSWORD must be set in .env or .env.local');
    }

    console.log(`\nLinkedIn DOM Dumper`);
    console.log(`keyword  : ${options.keyword}`);
    console.log(`headless : ${process.env.LINKEDIN_HEADLESS ?? 'true'}`);
    console.log(`output   : ${options.outputDir}/\n`);

    // ── Get authenticated page ─────────────────────────────────────────────
    console.log('Logging in...');
    const page: Page = await sessionService.getAuthenticatedPage();

    // ── Navigate to search ────────────────────────────────────────────────
    const searchUrl = `https://www.linkedin.com/search/results/content/?keywords=${encodeURIComponent(options.keyword)}&sortBy=date_posted`;
    console.log(`Navigating to: ${searchUrl}`);

    await (page as any).goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await (page as any)
      .waitForSelector(LINKEDIN_SELECTORS.waitForPost, { timeout: 12000 })
      .catch(() => console.warn('  waitForPost timed out — continuing anyway'));

    // Scroll to load lazy content
    console.log('Scrolling to trigger lazy content...');
    for (const d of [300, 600, 400, 400]) {
      await (page as any).evaluate((distance: number) => window.scrollBy(0, distance), d);
      await page.waitForTimeout(600);
    }

    // ── Run selector audit ────────────────────────────────────────────────
    console.log('Running selector audit...');
    const audit = await diagnostics.logSearchDiagnostics(page, {
      phase: 'dom-dump',
      keyword: options.keyword,
    });

    if (!audit)
      throw new Error('Selector audit returned null — page may not have loaded correctly');

    // ── Capture card HTMLs ────────────────────────────────────────────────
    console.log(`Capturing first ${options.maxCards} card HTML snippets...`);
    const cardHtmls: string[] = await (page as any).evaluate(
      ({ sel, max }: { sel: typeof LINKEDIN_SELECTORS; max: number }) => {
        const results: string[] = [];
        for (const css of sel.postContainers) {
          const cards = document.querySelectorAll(css);
          if (cards.length > 0) {
            Array.from(cards)
              .slice(0, max)
              .forEach((c) => results.push(c.outerHTML));
            break;
          }
        }
        return results;
      },
      { sel: LINKEDIN_SELECTORS, max: options.maxCards },
    );

    // ── Capture full page HTML ────────────────────────────────────────────
    console.log('Capturing full page HTML...');
    const fullHtml: string = await (page as any).evaluate(() => document.documentElement.outerHTML);

    // ── Write output files ────────────────────────────────────────────────
    fs.mkdirSync(options.outputDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
    const slug = options.keyword.replace(/[^a-z0-9]+/gi, '-').slice(0, 40);
    const base = path.join(options.outputDir, `${timestamp}_${slug}`);

    const report = renderAuditReport(
      audit,
      options.keyword,
      cardHtmls,
      timestamp,
      options.outputDir,
    );

    const cardsHtml = cardHtmls.map((html, i) => `<!-- card ${i + 1} -->\n${html}`).join('\n\n');

    fs.writeFileSync(`${base}_report.txt`, report, 'utf8');
    fs.writeFileSync(`${base}_cards.html`, cardsHtml, 'utf8');
    fs.writeFileSync(`${base}_full.html`, fullHtml, 'utf8');

    // ── Print report to console ───────────────────────────────────────────
    console.log('\n' + report);
    console.log(`\nFiles written to ${options.outputDir}/`);

    await shutdown(0);
  } catch (error) {
    console.error(`\nDump failed: ${error instanceof Error ? error.message : String(error)}`);
    await shutdown(1);
  }
}

void main();
