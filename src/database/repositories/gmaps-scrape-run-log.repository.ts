import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';

export interface GmapsScrapeRunLogStartData {
  runId: string;
  campaignId: string;
  organizationId: string;
  queryKey: string;
  searchTerm: string;
  metadata?: Prisma.InputJsonObject;
}

export interface GmapsScrapeRunLogFinishData {
  completedAt: Date;
  durationMs: number;
  scrollAttempts: number;
  candidateUrlsCollected: number;
  cursorCacheHits: number;
  dbBatchDuplicates: number;
  extractionFailures: number;
  candidatesExtracted: number;
  endReason: string;
  errorSummary?: string;
}

@Injectable()
export class GmapsScrapeRunLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async start(data: GmapsScrapeRunLogStartData): Promise<string> {
    const row = await this.prisma.gmapsScrapeRunLog.create({
      data: {
        runId: data.runId,
        campaignId: data.campaignId,
        organizationId: data.organizationId,
        queryKey: data.queryKey,
        searchTerm: data.searchTerm,
        metadata: data.metadata ?? undefined,
      },
      select: { id: true },
    });
    return row.id;
  }

  async finish(id: string, data: GmapsScrapeRunLogFinishData): Promise<void> {
    await this.prisma.gmapsScrapeRunLog.update({
      where: { id },
      data: {
        completedAt: data.completedAt,
        durationMs: data.durationMs,
        scrollAttempts: data.scrollAttempts,
        candidateUrlsCollected: data.candidateUrlsCollected,
        cursorCacheHits: data.cursorCacheHits,
        dbBatchDuplicates: data.dbBatchDuplicates,
        extractionFailures: data.extractionFailures,
        candidatesExtracted: data.candidatesExtracted,
        endReason: data.endReason,
        errorSummary: data.errorSummary ?? undefined,
      },
    }).catch(() => {});
  }

  async incrementIngestion(
    id: string,
    delta: { ingestionDuplicates?: number; newLeadsSaved?: number },
  ): Promise<void> {
    await this.prisma.gmapsScrapeRunLog.update({
      where: { id },
      data: {
        ...(delta.ingestionDuplicates ? { ingestionDuplicates: { increment: delta.ingestionDuplicates } } : {}),
        ...(delta.newLeadsSaved ? { newLeadsSaved: { increment: delta.newLeadsSaved } } : {}),
      },
    }).catch(() => {});
  }
}
