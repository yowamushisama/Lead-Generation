import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  ScrapeCursorData,
  ScrapeCursorAnchorData,
  MAX_SEEN_IDS,
  MAX_TAIL_IDS,
} from './campaign-scrape-cursor.types';

export { ScrapeCursorData, ScrapeCursorAnchorData };

@Injectable()
export class CampaignScrapeCursorRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Normal adapter lookup — excludes archived cursors. */
  async findActive(campaignId: string, source: string, queryKey: string) {
    return this.prisma.campaignScrapeCursor.findFirst({
      where: { campaignId, source, queryKey, archived: false },
    });
  }

  /** Full lookup including archived rows — used by reconciliation. */
  async findOne(
    campaignId: string,
    source: string,
    queryKey: string,
    opts?: { includeArchived?: boolean },
  ) {
    if (opts?.includeArchived) {
      return this.prisma.campaignScrapeCursor.findUnique({
        where: { campaignId_source_queryKey: { campaignId, source, queryKey } },
      });
    }
    return this.findActive(campaignId, source, queryKey);
  }

  /** Load all cursors for a campaign (for reconciliation). Includes archived. */
  async findAllForCampaign(campaignId: string, source?: string) {
    return this.prisma.campaignScrapeCursor.findMany({
      where: { campaignId, ...(source ? { source } : {}) },
    });
  }

  /** Standard per-query cursor write-back. Must NOT touch archived/archivedAt/archivedReason. */
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
        // archived/archivedAt/archivedReason intentionally excluded — only archive()/unarchive() touch these
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

  /** Append listing keys to tailIds (last 80 DOM-observed keys; separate from seenExternalIds). */
  async appendTail(
    campaignId: string,
    source: string,
    queryKey: string,
    ids: string[],
  ): Promise<void> {
    if (ids.length === 0) return;

    const existing = await this.prisma.campaignScrapeCursor.findUnique({
      where: { campaignId_source_queryKey: { campaignId, source, queryKey } },
      select: { tailIds: true },
    });

    const current: string[] = existing?.tailIds ?? [];
    const merged = [...current, ...ids];
    const fifo = merged.length > MAX_TAIL_IDS ? merged.slice(merged.length - MAX_TAIL_IDS) : merged;

    await this.prisma.campaignScrapeCursor.upsert({
      where: { campaignId_source_queryKey: { campaignId, source, queryKey } },
      create: { campaignId, source, queryKey, tailIds: fifo },
      update: { tailIds: fifo },
    });
  }

  /** Write anchor / plaintext label / probe telemetry after a successful query. */
  async updateAnchor(
    campaignId: string,
    source: string,
    queryKey: string,
    data: ScrapeCursorAnchorData,
  ): Promise<void> {
    await this.prisma.campaignScrapeCursor.update({
      where: { campaignId_source_queryKey: { campaignId, source, queryKey } },
      data: {
        ...(data.anchorPlaceId !== undefined ? { anchorPlaceId: data.anchorPlaceId } : {}),
        ...(data.keyword !== undefined ? { keyword: data.keyword } : {}),
        ...(data.industry !== undefined ? { industry: data.industry } : {}),
        ...(data.location !== undefined ? { location: data.location } : {}),
        ...(data.lastEndReason !== undefined ? { lastEndReason: data.lastEndReason } : {}),
        ...(data.fastScrollLastUsed !== undefined ? { fastScrollLastUsed: data.fastScrollLastUsed } : {}),
        ...(data.fastScrollBudgetDelta !== undefined
          ? { fastScrollBudgetUsed: { increment: data.fastScrollBudgetDelta } }
          : {}),
        ...(data.fastScrollHitRate !== undefined ? { fastScrollHitRate: data.fastScrollHitRate } : {}),
      },
    }).catch(() => {});
  }

  /** Archive a cursor whose search triple is no longer in the active ICP/campaign. */
  async archive(
    campaignId: string,
    source: string,
    queryKey: string,
    reason: string,
  ): Promise<void> {
    await this.prisma.campaignScrapeCursor.update({
      where: { campaignId_source_queryKey: { campaignId, source, queryKey } },
      data: { archived: true, archivedAt: new Date(), archivedReason: reason },
    }).catch(() => {});
  }

  /** Reactivate a previously-archived cursor when its triple reappears in the ICP/campaign. */
  async unarchive(campaignId: string, source: string, queryKey: string): Promise<void> {
    await this.prisma.campaignScrapeCursor.update({
      where: { campaignId_source_queryKey: { campaignId, source, queryKey } },
      data: { archived: false, archivedAt: null, archivedReason: null },
    }).catch(() => {});
  }
}
