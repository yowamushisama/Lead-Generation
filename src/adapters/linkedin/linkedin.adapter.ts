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
import { LinkedInAdapterConfig } from './linkedin-adapter.config';

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
    const searchFilters = liConfig.searchFilters ?? {};
    const postFilters = liConfig.postFilters ?? {};
    const scrollSteps = liConfig.scrollSteps ?? 5;

    let yielded = 0;
    const seenAuthors = new Set<string>();
    // Accumulate leads for JSON file output only when outputFile is configured
    const accumulatedLeads: RawLeadInput[] = liConfig.outputFile ? [] : ([] as never[]);

    this.summaryService.startRun(liConfig);

    // Authenticate once — reuse the same page across all keywords.
    // The persistent browser context means LinkedIn sees the same device every time.
    const page = await this.sessionService.getAuthenticatedPage();

    try {
      for (const keyword of keywords) {
        if (yielded >= maxResults) break;

        const kwStart = Date.now();
        let kwPostsFound = 0;
        let kwYielded = 0;
        let rateLimited = false;

        try {
          await this.searchService.navigateToSearch(
            page,
            keyword,
            searchFilters,
            liConfig.organizationId,
          );
          await this.diagnostics.logPageState(page, {
            phase: 'search-results',
            keyword,
            organizationId: liConfig.organizationId,
          });

          rateLimited = await this.searchService.isRateLimited(page);
          if (rateLimited) {
            this.logWarn('LinkedIn rate limit / checkpoint detected — skipping keyword', {
              keyword,
              organizationId: liConfig.organizationId,
            });
            this.summaryService.recordKeyword(keyword, {
              postsFound: 0,
              yielded: 0,
              durationMs: Date.now() - kwStart,
              rateLimited: true,
            });
            continue;
          }

          await this.searchService.scroll(page, scrollSteps);

          await this.diagnostics.logSearchDiagnostics(page, {
            phase: 'pre-extract',
            keyword,
            organizationId: liConfig.organizationId,
          });

          const rawPosts = await this.extractionService.extractPosts(page);
          const posts = this.extractionService.applyFilters(rawPosts, postFilters);
          kwPostsFound = rawPosts.length;

          this.log(`Found ${rawPosts.length} posts (${posts.length} after filters) for keyword: "${keyword}"`, {
            organizationId: liConfig.organizationId,
          });

          for (const post of posts) {
            if (yielded >= maxResults) break;

            // One lead per LinkedIn profile — skip repeated authors seen in this run
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
              headline: this.sanitizeText(post.headline),
              originalContent: this.sanitizeText(post.content),
              metadata: {
                keyword,
                postedAt: post.postedAt,
                campaignId: liConfig.campaignId,
                scrapedAt: new Date().toISOString(),
              },
            };

            if (liConfig.outputFile) {
              accumulatedLeads.push(lead);
            }

            yield lead;
            kwYielded++;
            yielded++;
          }
        } catch (error) {
          this.summaryService.recordError(keyword, error);
          this.logError(`Error scraping LinkedIn for keyword: "${keyword}"`, error);
          continue;
        }

        this.summaryService.recordKeyword(keyword, {
          postsFound: kwPostsFound,
          yielded: kwYielded,
          durationMs: Date.now() - kwStart,
          rateLimited,
        });
      }
    } finally {
      await (page as any).close().catch(() => {});

      const summary = this.summaryService.finalize(yielded);
      this.log('LinkedIn collect run summary', {
        organizationId: liConfig.organizationId,
        summary,
      });

      if (liConfig.outputFile && accumulatedLeads.length > 0) {
        await this.summaryService
          .writeLeadsFile(accumulatedLeads, liConfig.outputFile, summary)
          .catch((err: unknown) =>
            this.logError('Failed to write leads JSON file', err),
          );
      }
    }
  }
}
