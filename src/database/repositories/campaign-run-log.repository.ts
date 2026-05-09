import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';

export interface CampaignRunLogStartData {
  runId: string;
  campaignId: string;
  organizationId: string;
  trigger: string;
  goalMaxLeads: number;
  adaptersAttempted?: string[];
  metadata?: Prisma.InputJsonObject;
}

export interface CampaignRunLogFinishData {
  completedAt: Date;
  durationMs: number;
  status: 'COMPLETED' | 'FAILED';
  reachedGoal: boolean;
  endReason: string;
  adaptersUsed: string[];
  adaptersSkipped: Array<{ adapter: string; reason: string }>;
  candidatesYielded: number;
  duplicatesAtAdapter: number;
  duplicatesAtIngestion: number;
  newLeadsSaved: number;
  enqueuedToPipeline: number;
  errors: number;
  errorSummary?: unknown;
}

@Injectable()
export class CampaignRunLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async start(data: CampaignRunLogStartData): Promise<void> {
    await this.prisma.campaignRunLog.create({
      data: {
        runId: data.runId,
        campaignId: data.campaignId,
        organizationId: data.organizationId,
        trigger: data.trigger,
        goalMaxLeads: data.goalMaxLeads,
        status: 'RUNNING',
        adaptersAttempted: data.adaptersAttempted ?? [],
        metadata: data.metadata ?? undefined,
      },
    });
  }

  async finish(runId: string, data: CampaignRunLogFinishData): Promise<void> {
    await this.prisma.campaignRunLog.update({
      where: { runId },
      data: {
        completedAt: data.completedAt,
        durationMs: data.durationMs,
        status: data.status,
        reachedGoal: data.reachedGoal,
        endReason: data.endReason,
        adaptersUsed: data.adaptersUsed,
        adaptersSkipped: data.adaptersSkipped,
        candidatesYielded: data.candidatesYielded,
        duplicatesAtAdapter: data.duplicatesAtAdapter,
        duplicatesAtIngestion: data.duplicatesAtIngestion,
        newLeadsSaved: data.newLeadsSaved,
        enqueuedToPipeline: data.enqueuedToPipeline,
        errors: data.errors,
        errorSummary: data.errorSummary ?? undefined,
      },
    });
  }

  async markLockedOut(data: Omit<CampaignRunLogStartData, 'adaptersAttempted' | 'metadata'>): Promise<void> {
    await this.prisma.campaignRunLog.create({
      data: {
        runId: data.runId,
        campaignId: data.campaignId,
        organizationId: data.organizationId,
        trigger: data.trigger,
        goalMaxLeads: data.goalMaxLeads,
        status: 'LOCKED_OUT',
        endReason: 'LOCKED',
        completedAt: new Date(),
        durationMs: 0,
      },
    });
  }

  async markFailed(runId: string, error: unknown): Promise<void> {
    await this.prisma.campaignRunLog.update({
      where: { runId },
      data: {
        status: 'FAILED',
        endReason: 'ERROR',
        completedAt: new Date(),
        errorSummary: { message: String(error) },
      },
    }).catch(() => {});
  }
}
