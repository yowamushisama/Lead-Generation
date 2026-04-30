/**
 * LinkedIn Selector Verifier
 *
 * Runs a headless selector audit against canary keywords and writes:
 *   linkedin-dom-dumps/verify_<date>_report.txt
 *   linkedin-dom-dumps/verify_<date>_cards.html
 *
 * Exits 0 when all selector groups are active. Exits 1 on any broken group or
 * zero cards — this makes it usable as a gate in the scheduled Claude trigger.
 *
 * Usage:
 *   npm run linkedin:verify
 *   LINKEDIN_VERIFY_KEYWORDS="hiring SDR,b2b saas" npm run linkedin:verify
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
import { LinkedInDiagnosticsService, DomAuditResult } from '../adapters/linkedin/linkedin-diagnostics.service';
import { LINKEDIN_SELECTORS } from '../adapters/linkedin/linkedin-selectors.config';
import { buildSearchUrl } from '../adapters/linkedin/linkedin-search.service';

// ── Minimal in-memory Redis ──────────────────────────────────────────────────

class InMemoryRedisService {
  private readonly store = new Map<string, { value: string; expiresAt?: number }>();
  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && entry.expiresAt <= Date.now()) { this.store.delete(key); return null; }
    return entry.value;
  }
  async set(key: string, value: string): Promise<void> { this.store.set(key, { value }); }
  async expire(key: string, ttl: number): Promise<void> {
    const e = this.store.get(key); if (e) e.expiresAt = Date.now() + ttl * 1000;
  }
}

// ── NestJS module ────────────────────────────────────────────────────────────

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env.local', '.env'], cache: true })],
  providers: [
    LinkedInStealthService,
    LinkedInProxyService,
    LinkedInSessionService,
    LinkedInDiagnosticsService,
    { provide: RedisService, useClass: InMemoryRedisService },
  ],
})
class VerifierModule {}

// ── Report ───────────────────────────────────────────────────────────────────

function summariseAudit(audit: DomAuditResult): { broken: string[]; ok: string[] } {
  const groups = [
    ['postContainers', audit.postContainers],
    ['authorName', audit.authorName],
    ['authorLink', audit.authorLink],
    ['content', audit.content],
    ['headline', audit.headline],
    ['postedAt', audit.postedAt],
  ] as const;
  const broken: string[] = [];
  const ok: string[] = [];
  for (const [name, g] of groups) {
    (g.active === null ? broken : ok).push(name);
  }
  return { broken, ok };
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(VerifierModule, { logger: ['warn', 'error'] });
  const configService = app.get(ConfigService);
  const sessionService = app.get(LinkedInSessionService);
  const diagnostics = app.get(LinkedInDiagnosticsService);

  const raw = configService.get<string>('LINKEDIN_VERIFY_KEYWORDS') ?? '';
  const keywords = raw
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean)
    .slice(0, 3);

  if (keywords.length === 0) {
    console.error(
      'Set LINKEDIN_VERIFY_KEYWORDS="keyword1,keyword2" in .env to enable verify. Exiting 0 (skipped).',
    );
    await app.close();
    process.exit(0);
  }

  const outputDir = 'linkedin-dom-dumps';
  fs.mkdirSync(outputDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);

  let overallBroken = false;
  const reportLines: string[] = [`LinkedIn Selector Verify — ${timestamp}`, ''];
  const allCardHtmls: string[] = [];

  console.log(`\nLinkedIn Selector Verifier — ${timestamp}`);
  console.log(`Keywords: ${keywords.join(', ')}\n`);

  const page = await sessionService.getAuthenticatedPage();

  try {
    for (const keyword of keywords) {
      const url = buildSearchUrl(keyword, {});
      console.log(`Auditing: "${keyword}"`);

      await (page as any).goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await (page as any)
        .waitForSelector(LINKEDIN_SELECTORS.waitForPost, { timeout: 12000 })
        .catch(() => {});

      for (const d of [300, 600, 400]) {
        await (page as any).evaluate((dist: number) => window.scrollBy(0, dist), d);
        await page.waitForTimeout(700);
      }

      const audit = await diagnostics.logSearchDiagnostics(page, { phase: 'verify', keyword });
      if (!audit) {
        reportLines.push(`[FAIL] "${keyword}" — audit returned null`);
        overallBroken = true;
        continue;
      }

      const { broken, ok } = summariseAudit(audit);
      const status = broken.length === 0 ? 'PASS' : 'FAIL';
      if (broken.length > 0) overallBroken = true;

      reportLines.push(`[${status}] "${keyword}" — cards: ${audit.totalCards}`);
      if (broken.length > 0) reportLines.push(`       broken groups: ${broken.join(', ')}`);
      if (ok.length > 0) reportLines.push(`       ok groups    : ${ok.join(', ')}`);
      reportLines.push('');

      // Capture card HTMLs for the first keyword
      if (allCardHtmls.length === 0 && audit.totalCards > 0) {
        const htmls: string[] = await (page as any).evaluate(
          ({ sel, max }: { sel: typeof LINKEDIN_SELECTORS; max: number }) => {
            const out: string[] = [];
            for (const css of sel.postContainers) {
              const cards = document.querySelectorAll(css);
              if (cards.length > 0) {
                Array.from(cards).slice(0, max).forEach((c) => out.push(c.outerHTML));
                break;
              }
            }
            return out;
          },
          { sel: LINKEDIN_SELECTORS, max: 5 },
        );
        allCardHtmls.push(...htmls);
      }
    }
  } finally {
    await (page as any).close().catch(() => {});
    await app.close();
  }

  reportLines.push(`Selector version: v${LINKEDIN_SELECTORS.version} (lastVerified: ${LINKEDIN_SELECTORS.lastVerified})`);
  reportLines.push(`Overall result  : ${overallBroken ? 'FAIL — update linkedin-selectors.config.ts' : 'PASS'}`);

  const reportPath = path.join(outputDir, `verify_${timestamp}_report.txt`);
  const cardsPath = path.join(outputDir, `verify_${timestamp}_cards.html`);

  fs.writeFileSync(reportPath, reportLines.join('\n'), 'utf8');
  fs.writeFileSync(
    cardsPath,
    allCardHtmls.map((h, i) => `<!-- card ${i + 1} -->\n${h}`).join('\n\n'),
    'utf8',
  );

  console.log('\n' + reportLines.join('\n'));
  console.log(`\nReport  : ${reportPath}`);
  console.log(`Cards   : ${cardsPath}`);

  process.exit(overallBroken ? 1 : 0);
}

void main().catch((err) => {
  console.error('verify-linkedin-selectors failed:', err);
  process.exit(1);
});
