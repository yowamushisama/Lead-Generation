import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { AppLogger } from '../../common/utils/logger.util';
import type { RawLeadInput } from '../../common/interfaces/lead-input.interface';
import type { LinkedInAdapterConfig } from './linkedin-adapter.config';

export interface KeywordStats {
  postsFound: number;
  yielded: number;
  durationMs: number;
  rateLimited: boolean;
  error?: string;
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

/**
 * Accumulates per-keyword statistics across a LinkedIn adapter run and emits
 * a structured summary at the end. Also handles writing an optional JSON leads file.
 */
@Injectable()
export class LinkedInRunSummaryService {
  private readonly logger = new AppLogger(LinkedInRunSummaryService.name);

  private runId = '';
  private startedAt = '';
  private config: LinkedInAdapterConfig | null = null;
  private perKeyword: RunSummary['perKeyword'] = [];

  /** Call once at the start of a collect() run to initialise state. */
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

  /** Record per-keyword statistics after each keyword completes. */
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

  /** Record an error that caused a keyword to be skipped. */
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

  /** Build and return the final run summary. Call once after the keyword loop. */
  finalize(totalYielded: number): RunSummary {
    const completedAt = new Date().toISOString();
    const startMs = new Date(this.startedAt).getTime();
    const durationMs = Date.now() - startMs;

    return {
      runId: this.runId,
      startedAt: this.startedAt,
      completedAt,
      durationMs,
      organizationId: this.config?.organizationId ?? '',
      campaignId: this.config?.campaignId,
      keywords: this.config?.keywords ?? [],
      totalYielded,
      perKeyword: [...this.perKeyword],
    };
  }

  /**
   * Writes a JSON file containing all collected leads and run metadata.
   *
   * If `outputPath` ends with '/' (or is a directory), a timestamped filename
   * is auto-generated. Otherwise `outputPath` is used as the full file path.
   * The containing directory is created if it does not exist.
   */
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
