import { Injectable, Optional } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { AppLogger } from '../../common/utils/logger.util';
import type { RawLeadInput } from '../../common/interfaces/lead-input.interface';
import type { LinkedInAdapterConfig } from './linkedin-adapter.config';
import { LinkedInRunRepository } from '../../database/repositories/linkedin-run.repository';
import { LINKEDIN_SELECTORS } from './linkedin-selectors.config';

export interface KeywordStats {
  postsFound: number;
  yielded: number;
  durationMs: number;
  rateLimited: boolean;
  error?: string;
}

export interface RunHealth {
  healthy: boolean;
  reason?: string;
  extractionRate: number;
  rateLimitRate: number;
}

export interface RunSummary {
  runId: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  organizationId: string;
  campaignId?: string;
  keywords: string[];
  totalYielded: number;
  health: RunHealth;
  perKeyword: Array<{
    keyword: string;
    postsFound: number;
    yielded: number;
    durationMs: number;
    rateLimited: boolean;
    error?: string;
  }>;
  leadsFilePath?: string;
}

interface LeadsFileContents {
  generatedAt: string;
  runId: string;
  organizationId: string;
  campaignId?: string;
  keywords: string[];
  filters: {
    searchFilters?: LinkedInAdapterConfig['searchFilters'];
    postFilters?: LinkedInAdapterConfig['postFilters'];
  };
  totalCount: number;
  leads: RawLeadInput[];
}

@Injectable()
export class LinkedInRunSummaryService {
  private readonly logger = new AppLogger(LinkedInRunSummaryService.name);

  private runId = '';
  private startedAt = '';
  private config: LinkedInAdapterConfig | null = null;
  private perKeyword: RunSummary['perKeyword'] = [];

  constructor(
    @Optional() private readonly linkedInRunRepo?: LinkedInRunRepository,
  ) {}

  startRun(config: LinkedInAdapterConfig): void {
    this.runId = crypto.randomUUID();
    this.startedAt = new Date().toISOString();
    this.config = config;
    this.perKeyword = [];

    this.logger.log({
      message: 'LinkedIn collect run started',
      module: 'linkedin',
      runId: this.runId,
      organizationId: config.organizationId,
      campaignId: config.campaignId,
      keywords: config.keywords ?? [],
      maxResults: config.maxResults,
    });
  }

  recordKeyword(keyword: string, stats: KeywordStats): void {
    this.perKeyword.push({ keyword, ...stats });

    this.logger.log({
      message: 'LinkedIn keyword scraped',
      module: 'linkedin',
      runId: this.runId,
      keyword,
      postsFound: stats.postsFound,
      yielded: stats.yielded,
      durationMs: stats.durationMs,
      rateLimited: stats.rateLimited,
    });
  }

  recordError(keyword: string, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.perKeyword.push({
      keyword,
      postsFound: 0,
      yielded: 0,
      durationMs: 0,
      rateLimited: false,
      error: message,
    });
  }

  computeHealth(totalYielded: number, maxResults: number): RunHealth {
    const total = this.perKeyword.length;
    if (total === 0) {
      return { healthy: false, reason: 'no keywords processed', extractionRate: 0, rateLimitRate: 0 };
    }

    const rateLimitedCount = this.perKeyword.filter((k) => k.rateLimited).length;
    const driftCount = this.perKeyword.filter((k) => !k.rateLimited && k.postsFound === 0 && !k.error).length;

    const extractionRate = maxResults > 0 ? totalYielded / maxResults : 0;
    const rateLimitRate = total > 0 ? rateLimitedCount / total : 0;

    if (extractionRate < 0.3) {
      return {
        healthy: false,
        reason: `low extraction rate: ${(extractionRate * 100).toFixed(0)}% (threshold 30%)`,
        extractionRate,
        rateLimitRate,
      };
    }
    if (driftCount / total > 0.5) {
      return {
        healthy: false,
        reason: `selector drift: ${driftCount}/${total} keywords returned 0 posts (not rate-limited)`,
        extractionRate,
        rateLimitRate,
      };
    }
    if (rateLimitRate > 0.25) {
      return {
        healthy: false,
        reason: `high rate-limit rate: ${(rateLimitRate * 100).toFixed(0)}% of keywords`,
        extractionRate,
        rateLimitRate,
      };
    }
    return { healthy: true, extractionRate, rateLimitRate };
  }

  async finalize(totalYielded: number): Promise<RunSummary> {
    const completedAt = new Date().toISOString();
    const startMs = new Date(this.startedAt).getTime();
    const durationMs = Date.now() - startMs;
    const maxResults = this.config?.maxResults ?? 100;
    const health = this.computeHealth(totalYielded, maxResults);

    const errors = this.perKeyword
      .filter((k) => k.error)
      .map((k) => ({ keyword: k.keyword, error: k.error }));

    const summary: RunSummary = {
      runId: this.runId,
      startedAt: this.startedAt,
      completedAt,
      durationMs,
      organizationId: this.config?.organizationId ?? '',
      campaignId: this.config?.campaignId,
      keywords: this.config?.keywords ?? [],
      totalYielded,
      health,
      perKeyword: [...this.perKeyword],
    };

    if (this.linkedInRunRepo) {
      try {
        await this.linkedInRunRepo.create({
          runId: this.runId,
          organizationId: summary.organizationId,
          campaignId: summary.campaignId,
          startedAt: new Date(this.startedAt),
          completedAt: new Date(completedAt),
          durationMs,
          totalYielded,
          extractionRate: health.extractionRate,
          rateLimitRate: health.rateLimitRate,
          healthy: health.healthy,
          healthReason: health.reason,
          selectorVersion: LINKEDIN_SELECTORS.version,
          perKeyword: this.perKeyword,
          errors,
        });
      } catch (err) {
        this.logger.error({
          message: 'Failed to persist LinkedIn run to DB',
          module: 'linkedin',
          runId: this.runId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return summary;
  }

  async writeLeadsFile(
    leads: RawLeadInput[],
    outputPath: string,
    summary: RunSummary,
  ): Promise<string> {
    const isDir = outputPath.endsWith('/') || outputPath.endsWith('\\');
    let filePath: string;

    if (isDir) {
      const timestamp = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
      const orgSlug = (summary.organizationId ?? 'org').replace(/[^a-z0-9]/gi, '-').slice(0, 30);
      const filename = `linkedin-leads_${timestamp}_${orgSlug}.json`;
      filePath = path.join(outputPath, filename);
    } else {
      filePath = outputPath;
    }

    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });

    const contents: LeadsFileContents = {
      generatedAt: new Date().toISOString(),
      runId: summary.runId,
      organizationId: summary.organizationId,
      campaignId: summary.campaignId,
      keywords: summary.keywords,
      filters: {
        searchFilters: this.config?.searchFilters,
        postFilters: this.config?.postFilters,
      },
      totalCount: leads.length,
      leads,
    };

    await fs.promises.writeFile(filePath, JSON.stringify(contents, null, 2), 'utf8');

    this.logger.log({
      message: 'LinkedIn leads JSON file written',
      module: 'linkedin',
      runId: summary.runId,
      filePath,
      totalCount: leads.length,
    });

    return filePath;
  }
}
