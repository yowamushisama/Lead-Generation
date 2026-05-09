import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

export interface ScrapeCursorData {
  lastRunAt: Date;
  lastScrollSteps: number;
  totalSeenDelta: number;
  lastNewCount: number;
  consecutiveZeroRuns: number;
  lastNewLeadAt: Date | null;
  exhausted: boolean;
  lastScrollDepth?: number;
  duplicateWallHits?: number;
}

const MAX_SEEN_IDS = 2000;

@Injectable()
export class CampaignScrapeCursorRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(campaignId: string, source: string, queryKey: string) {
    return this.prisma.campaignScrapeCursor.findUnique({
      where: { campaignId_source_queryKey: { campaignId, source, queryKey } },
    });
  }

  async upsert(
    campaignId: string,
    source: string,
    queryKey: string,
    data: ScrapeCursorData,
  ) {
    return this.prisma.campaignScrapeCursor.upsert({
      where: { campaignId_source_queryKey: { campaignId, source, queryKey } },
      create: {
        campaignId,
        source,
        queryKey,
        lastRunAt: data.lastRunAt,
        lastScrollSteps: data.lastScrollSteps,
        totalSeen: data.totalSeenDelta,
        lastNewCount: data.lastNewCount,
        consecutiveZeroRuns: data.consecutiveZeroRuns,
        lastNewLeadAt: data.lastNewLeadAt,
        exhausted: data.exhausted,
      },
      update: {
        lastRunAt: data.lastRunAt,
        lastScrollSteps: data.lastScrollSteps,
        totalSeen: { increment: data.totalSeenDelta },
        lastNewCount: data.lastNewCount,
        consecutiveZeroRuns: data.consecutiveZeroRuns,
        lastNewLeadAt: data.lastNewLeadAt ?? undefined,
        exhausted: data.exhausted,
        ...(data.lastScrollDepth !== undefined ? { lastScrollDepth: { increment: data.lastScrollDepth } } : {}),
        ...(data.duplicateWallHits !== undefined ? { duplicateWallHits: { increment: data.duplicateWallHits } } : {}),
      },
    });
  }

  async appendSeen(
    campaignId: string,
    source: string,
    queryKey: string,
    ids: string[],
  ): Promise<void> {
    if (ids.length === 0) return;

    const existing = await this.prisma.campaignScrapeCursor.findUnique({
      where: { campaignId_source_queryKey: { campaignId, source, queryKey } },
      select: { seenExternalIds: true },
    });

    const current: string[] = existing?.seenExternalIds ?? [];
    const merged = [...current, ...ids];
    const fifo = merged.length > MAX_SEEN_IDS ? merged.slice(merged.length - MAX_SEEN_IDS) : merged;

    await this.prisma.campaignScrapeCursor.upsert({
      where: { campaignId_source_queryKey: { campaignId, source, queryKey } },
      create: { campaignId, source, queryKey, seenExternalIds: fifo },
      update: { seenExternalIds: fifo },
    });
  }
}
