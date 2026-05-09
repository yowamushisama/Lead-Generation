import { GmapsScrapeRunLogRepository } from '../../database/repositories/gmaps-scrape-run-log.repository';

interface QueryStats {
  logId: string;
  startedAt: Date;
  scrollAttempts: number;
  candidateUrlsCollected: number;
  cursorCacheHits: number;
  dbBatchDuplicates: number;
  extractionFailures: number;
  candidatesExtracted: number;
}

export interface GmapsRunStatsCollector {
  runId: string;
  beginQuery(opts: {
    queryKey: string;
    searchTerm: string;
    campaignId: string;
    organizationId: string;
  }): Promise<string>;
  recordScrollAttempt(logId: string): void;
  recordCandidateUrlsCollected(logId: string, n: number): void;
  recordCursorHit(logId: string, n: number): void;
  recordDbBatchDuplicate(logId: string, n: number): void;
  recordExtractionFailure(logId: string, n: number): void;
  recordCandidateExtracted(logId: string): void;
  finishQuery(logId: string, endReason: string, errorSummary?: string): Promise<void>;
  getTotalDuplicatesAtAdapter(): number;
}

export class GmapsRunStatsCollectorImpl implements GmapsRunStatsCollector {
  readonly runId: string;
  private readonly repo: GmapsScrapeRunLogRepository;
  private readonly queries = new Map<string, QueryStats>();
  private totalDuplicates = 0;

  constructor(runId: string, repo: GmapsScrapeRunLogRepository) {
    this.runId = runId;
    this.repo = repo;
  }

  async beginQuery(opts: {
    queryKey: string;
    searchTerm: string;
    campaignId: string;
    organizationId: string;
  }): Promise<string> {
    const logId = await this.repo.start({
      runId: this.runId,
      campaignId: opts.campaignId,
      organizationId: opts.organizationId,
      queryKey: opts.queryKey,
      searchTerm: opts.searchTerm,
    });
    this.queries.set(logId, {
      logId,
      startedAt: new Date(),
      scrollAttempts: 0,
      candidateUrlsCollected: 0,
      cursorCacheHits: 0,
      dbBatchDuplicates: 0,
      extractionFailures: 0,
      candidatesExtracted: 0,
    });
    return logId;
  }

  recordScrollAttempt(logId: string): void {
    const s = this.queries.get(logId);
    if (s) s.scrollAttempts++;
  }

  recordCandidateUrlsCollected(logId: string, n: number): void {
    const s = this.queries.get(logId);
    if (s) s.candidateUrlsCollected += n;
  }

  recordCursorHit(logId: string, n: number): void {
    const s = this.queries.get(logId);
    if (s) s.cursorCacheHits += n;
  }

  recordDbBatchDuplicate(logId: string, n: number): void {
    const s = this.queries.get(logId);
    if (s) s.dbBatchDuplicates += n;
  }

  recordExtractionFailure(logId: string, n: number): void {
    const s = this.queries.get(logId);
    if (s) s.extractionFailures += n;
  }

  recordCandidateExtracted(logId: string): void {
    const s = this.queries.get(logId);
    if (s) s.candidatesExtracted++;
  }

  async finishQuery(logId: string, endReason: string, errorSummary?: string): Promise<void> {
    const s = this.queries.get(logId);
    if (!s) return;

    // Accumulate into the persistent total BEFORE deleting from map.
    this.totalDuplicates += s.cursorCacheHits + s.dbBatchDuplicates;

    const now = new Date();
    await this.repo.finish(logId, {
      completedAt: now,
      durationMs: now.getTime() - s.startedAt.getTime(),
      scrollAttempts: s.scrollAttempts,
      candidateUrlsCollected: s.candidateUrlsCollected,
      cursorCacheHits: s.cursorCacheHits,
      dbBatchDuplicates: s.dbBatchDuplicates,
      extractionFailures: s.extractionFailures,
      candidatesExtracted: s.candidatesExtracted,
      endReason,
      errorSummary,
    });
    this.queries.delete(logId);
  }

  getTotalDuplicatesAtAdapter(): number {
    return this.totalDuplicates;
  }
}
