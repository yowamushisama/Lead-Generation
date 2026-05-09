/**
 * Dumps the Google Maps search results DOM for a given query so the
 * gmaps-selector-repair skill can update gmaps-selectors.config.ts.
 *
 * Usage:
 *   npm run gmaps:dump-dom -- --industries "plumber" --locations "Austin, TX"
 *
 * Output:
 *   gmaps-dom-dumps/YYYY-MM-DD_HH-mm_<query>_report.txt  (selector audit)
 *   gmaps-dom-dumps/YYYY-MM-DD_HH-mm_<query>_feed.html   (raw feed HTML)
 */
import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { GMAPS_SELECTORS } from '../adapters/google-maps/gmaps-selectors.config';
import { PlaywrightStealthService } from '../adapters/shared/playwright-stealth.service';
import { GmapsSearchService } from '../adapters/google-maps/gmaps-search.service';
import { GmapsExtractionService } from '../adapters/google-maps/gmaps-extraction.service';

function parseArgs(argv: string[]): { industry: string; location: string } {
  let industry = 'plumber';
  let location = 'Austin, TX';
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--industries' || argv[i] === '--industry') { industry = argv[++i]; }
    if (argv[i] === '--locations' || argv[i] === '--location') { location = argv[++i]; }
  }
  return { industry, location };
}

async function main(): Promise<void> {
  const { industry, location } = parseArgs(process.argv.slice(2));

  @Module({
    imports: [ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env.local', '.env'], cache: true })],
    providers: [PlaywrightStealthService, GmapsSearchService, GmapsExtractionService],
  })
  class DumpModule {}

  const app = await NestFactory.createApplicationContext(DumpModule, { logger: ['error'] });
  const searchService = app.get(GmapsSearchService);

  const page = await searchService.newPage();

  try {
    const searchTerm = `${industry} in ${location}`.replace(/\s+/g, ' ').trim();
    console.log(`Navigating to Google Maps: "${searchTerm}"...`);
    await searchService.navigateToSearch(page, searchTerm, 'dom-dump');
    await searchService.scrollFeed(page, 3);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
    const slug = `${industry.replace(/\s+/g, '_')}_${location.replace(/[^a-z0-9]/gi, '_')}`;
    const outDir = path.resolve(process.cwd(), 'gmaps-dom-dumps');
    fs.mkdirSync(outDir, { recursive: true });

    // Dump raw feed HTML
    const feedHtml: string = await (page as any).evaluate((sels: string[]) => {
      for (const sel of sels) {
        try {
          const el = document.querySelector(sel);
          if (el) return el.outerHTML;
        } catch { /* skip */ }
      }
      return document.body.outerHTML.slice(0, 200_000);
    }, GMAPS_SELECTORS.feedContainer);

    const htmlPath = path.join(outDir, `${timestamp}_${slug}_feed.html`);
    fs.writeFileSync(htmlPath, feedHtml, 'utf-8');

    // Run a simple selector audit
    const audit: Record<string, { matched: boolean; selector: string | null }> = await (page as any).evaluate(
      (selGroups: Record<string, string[]>) => {
        const result: Record<string, { matched: boolean; selector: string | null }> = {};
        for (const [group, sels] of Object.entries(selGroups)) {
          let matched = false;
          let matchedSel: string | null = null;
          for (const s of sels) {
            try {
              if (document.querySelector(s)) { matched = true; matchedSel = s; break; }
            } catch { /* skip */ }
          }
          result[group] = { matched, selector: matchedSel };
        }
        return result;
      },
      {
        feedContainer: GMAPS_SELECTORS.feedContainer,
        listingCards: GMAPS_SELECTORS.listingCards,
        tileName: GMAPS_SELECTORS.tileName,
        tileRating: GMAPS_SELECTORS.tileRating,
        tileReviewCount: GMAPS_SELECTORS.tileReviewCount,
        tileCategory: GMAPS_SELECTORS.tileCategory,
      },
    );

    const broken = Object.entries(audit).filter(([, v]) => !v.matched).map(([k]) => k);
    const lines = [
      `GMaps DOM Audit — "${industry} in ${location}"`,
      `Generated: ${new Date().toISOString()}`,
      `Selector version: v${GMAPS_SELECTORS.version} (last verified ${GMAPS_SELECTORS.lastVerified})`,
      '',
      ...Object.entries(audit).map(([group, v]) =>
        `  ${v.matched ? '✓' : '✗'}  ${group.padEnd(20)} ${v.matched ? v.selector : 'NO MATCH'}`,
      ),
      '',
      broken.length === 0
        ? 'RESULT: All selectors resolved.'
        : `RESULT: ${broken.length} broken: ${broken.join(', ')}. Update gmaps-selectors.config.ts using the feed HTML.`,
      '',
      `Feed HTML saved to: ${htmlPath}`,
    ];

    const reportPath = path.join(outDir, `${timestamp}_${slug}_report.txt`);
    fs.writeFileSync(reportPath, lines.join('\n'), 'utf-8');

    console.log('');
    lines.forEach((l) => console.log(l));
    console.log(`\nReport: ${reportPath}`);
  } finally {
    await (page as any).close().catch(() => {});
    await app.close().catch(() => {});
  }
}

void main();
