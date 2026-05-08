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
}

@Injectable()
export class CampaignScrapeCursorRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(campaignId: string, source: string, queryKey: string) {
    // @ts-ignore — available after `npm run prisma:generate` following the schema migration
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
    // @ts-ignore — available after `npm run prisma:generate` following the schema migration
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
      },
    });
  }
}
