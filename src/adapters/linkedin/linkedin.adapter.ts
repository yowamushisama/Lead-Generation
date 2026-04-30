import { Injectable } from '@nestjs/common';
import { BaseAdapter } from '../base.adapter';
import { AdapterConfig } from '../../common/interfaces/adapter.interface';
import { RawLeadInput } from '../../common/interfaces/lead-input.interface';
import { LeadSource } from '../../common/enums/lead-source.enum';
import { LinkedInStealthService } from './linkedin-stealth.service';
import { LinkedInSessionService } from './linkedin-session.service';
import { LinkedInDiagnosticsService } from './linkedin-diagnostics.service';
import { LinkedInSearchService } from './linkedin-search.service';
import { LinkedInExtractionService } from './linkedin-extraction.service';
import { LinkedInRunSummaryService } from './linkedin-run-summary.service';
import { LinkedInAlertService } from './linkedin-alert.service';
import { LinkedInAdapterConfig } from './linkedin-adapter.config';
import type { Page } from 'playwright';
import type { LinkedInSearchFilters, LinkedInPostFilters } from './linkedin-adapter.config';
import { retryWithBackoff, isRetryableError } from './linkedin-retry.util';

const SESSION_CHECK_EVERY = 5;
const MAX_KEYWORD_RETRIES = 6;

interface KeywordResult {
  posts: Array<{
    authorUrl: string | null;
    authorName: string;
    headline: string | null;
    content: string | null;
    postedAt: string | null;
  }>;
  postsFound: number;
  rateLimited: boolean;
}

@Injectable()
export class LinkedInAdapter extends BaseAdapter {
  readonly name = LeadSource.LINKEDIN;
  readonly sourceType = 'intent' as const;

  constructor(
    private readonly stealthService: LinkedInStealthService,
    private readonly sessionService: LinkedInSessionService,
    private readonly diagnostics: LinkedInDiagnosticsService,
    private readonly searchService: LinkedInSearchService,
    private readonly extractionService: LinkedInExtractionService,
    private readonly summaryService: LinkedInRunSummaryService,
    private readonly alertService: LinkedInAlertService,
  ) {
    super();
  }

  async isHealthy(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10000);
      const response = await fetch('https://www.linkedin.com', {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible)' },
      });
      clearTimeout(timer);
      return response.status < 500;
    } catch {
      return false;
    }
  }

  async *collect(config: AdapterConfig): AsyncGenerator<RawLeadInput> {
    this.validateConfig(config);

    const liConfig = config as LinkedInAdapterConfig;
    const keywords = liConfig.keywords ?? [];

    if (keywords.length === 0) {
      this.logWarn('No keywords configured for LinkedIn adapter', {
        organizationId: liConfig.organizationId,
      });
      return;
    }

    const maxResults = liConfig.maxResults ?? 100;
    const searchFilters: LinkedInSearchFilters = liConfig.searchFilters ?? {};
    const postFilters: LinkedInPostFilters = liConfig.postFilters ?? {};
    const scrollSteps = liConfig.scrollSteps ?? 5;
    const sessionCheckEvery = Number(liConfig.sessionCheckEvery ?? SESSION_CHECK_EVERY);

    let yielded = 0;
    let totalKeywordRetries = 0;
    const seenAuthors = new Set<string>();
    const accumulatedLeads: RawLeadInput[] = liConfig.outputFile ? [] : ([] as never[]);

    this.summaryService.startRun(liConfig);

    const page = await this.sessionService.getAuthenticatedPage();

    try {
      for (let ki = 0; ki < keywords.length; ki++) {
        const keyword = keywords[ki];
        if (yielded >= maxResults) break;

        // Mid-run session liveness check every N keywords
        if (ki > 0 && ki % sessionCheckEvery === 0) {
          await this.sessionService.revalidate(page).catch((err: unknown) => {
            this.logError('Session revalidation failed mid-run', err);
          });
        }

        const kwStart = Date.now();
        let kwYielded = 0;
        let kwResult: KeywordResult = { posts: [], postsFound: 0, rateLimited: false };

        try {
          await retryWithBackoff(
            async () => {
              const result = await this.scrapeKeyword(
                page,
                keyword,
                searchFilters,
                postFilters,
                scrollSteps,
                liConfig.organizationId,
              );
              kwResult = result;
              if (result.rateLimited) {
                if (totalKeywordRetries >= MAX_KEYWORD_RETRIES) {
                  await this.alertService.emit('rate-limit', {
                    keyword,
                    organizationId: liConfig.organizationId,
                    reason: 'max retries exhausted',
                  });
                  return; // give up on this keyword
                }
                totalKeywordRetries++;
                throw Object.assign(new Error('rate-limited'), { isRateLimit: true });
              }
            },
            { maxAttempts: 3, baseMs: 30_000, jitter: 0.3 },
          );
        } catch (err: unknown) {
          const isRateLimit = (err as { isRateLimit?: boolean }).isRateLimit === true;
          if (!isRateLimit && isRetryableError(err)) {
            this.summaryService.recordError(keyword, err);
            this.logError(`Error scraping LinkedIn for keyword: "${keyword}"`, err);
          }
        }

        // Yield collected posts outside the retry wrapper (generators can't yield inside closures)
        for (const post of kwResult.posts) {
          if (yielded >= maxResults) break;
          if (post.authorUrl && seenAuthors.has(post.authorUrl)) continue;
          if (post.authorUrl) seenAuthors.add(post.authorUrl);

          await page.waitForTimeout(this.stealthService.randomDelayMs(300, 1000));

          const lead: RawLeadInput = {
            externalId: post.authorUrl || undefined,
            source: LeadSource.LINKEDIN,
            sourceType: 'intent',
            sourceUrl: post.authorUrl
              ? this.buildSourceUrl('https://www.linkedin.com', post.authorUrl)
              : undefined,
            name: post.authorName,
            headline: post.headline ? this.sanitizeText(post.headline) : undefined,
            originalContent: post.content ? this.sanitizeText(post.content) : undefined,
            metadata: {
              keyword,
              postedAt: post.postedAt,
              campaignId: liConfig.campaignId,
              scrapedAt: new Date().toISOString(),
            },
          };

          if (liConfig.outputFile) accumulatedLeads.push(lead);
          yield lead;
          kwYielded++;
          yielded++;
        }

        if (kwResult.rateLimited) {
          this.logWarn('LinkedIn rate limit — skipping keyword', {
            keyword,
            organizationId: liConfig.organizationId,
          });
        }

        this.summaryService.recordKeyword(keyword, {
          postsFound: kwResult.postsFound,
          yielded: kwYielded,
          durationMs: Date.now() - kwStart,
          rateLimited: kwResult.rateLimited,
        });
      }
    } finally {
      await (page as any).close().catch(() => {});

      const summary = await this.summaryService.finalize(yielded);

      this.log('LinkedIn collect run summary', {
        organizationId: liConfig.organizationId,
        runId: summary.runId,
        totalYielded: summary.totalYielded,
        healthy: summary.health.healthy,
        healthReason: summary.health.reason,
        extractionRate: summary.health.extractionRate,
      });

      if (!summary.health.healthy) {
        const driftKeywords = summary.perKeyword
          .filter((k) => !k.rateLimited && k.postsFound === 0 && !k.error)
          .map((k) => k.keyword);

        if (summary.totalYielded === 0) {
          await this.alertService.emit('zero-leads', {
            organizationId: liConfig.organizationId,
            runId: summary.runId,
            reason: summary.health.reason,
          });
        } else if (driftKeywords.length > 0) {
          await this.alertService.emit('drift', {
            organizationId: liConfig.organizationId,
            runId: summary.runId,
            reason: summary.health.reason,
            driftKeywords,
          });
        }
      }

      if (liConfig.outputFile && accumulatedLeads.length > 0) {
        await this.summaryService
          .writeLeadsFile(accumulatedLeads, liConfig.outputFile, summary)
          .catch((err: unknown) => this.logError('Failed to write leads JSON file', err));
      }
    }
  }

  private async scrapeKeyword(
    page: Page,
    keyword: string,
    searchFilters: LinkedInSearchFilters,
    postFilters: LinkedInPostFilters,
    scrollSteps: number,
    organizationId: string,
  ): Promise<KeywordResult> {
    await this.searchService.navigateToSearch(page, keyword, searchFilters, organizationId);
    await this.diagnostics.logPageState(page, { phase: 'search-results', keyword, organizationId });

    const rateLimited = await this.searchService.isRateLimited(page);
    if (rateLimited) return { posts: [], postsFound: 0, rateLimited: true };

    await this.searchService.scroll(page, scrollSteps);
    await this.diagnostics.logSearchDiagnostics(page, { phase: 'pre-extract', keyword, organizationId });

    const rawPosts = await this.extractionService.extractPosts(page);
    const posts = this.extractionService.applyFilters(rawPosts, postFilters);

    this.log(
      `Found ${rawPosts.length} posts (${posts.length} after filters) for keyword: "${keyword}"`,
      { organizationId },
    );

    return { posts, postsFound: rawPosts.length, rateLimited: false };
  }
}
