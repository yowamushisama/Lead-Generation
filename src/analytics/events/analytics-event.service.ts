import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export type AnalyticsEventType =
  | 'lead.created'
  | 'lead.scored'
  | 'lead.personalized'
  | 'lead.disqualified'
  | 'lead.converted'
  | 'message.generated'
  | 'message.approved'
  | 'message.sent'
  | 'message.replied'
  | 'pipeline.started'
  | 'pipeline.completed'
  | 'ai.tokens_used';

@Injectable()
export class AnalyticsEventService {
  private readonly logger = new Logger(AnalyticsEventService.name);

  constructor(private readonly prisma: PrismaService) {}

  async track(
    organizationId: string,
    eventType: AnalyticsEventType,
    data: Record<string, unknown> = {},
    leadId?: string,
    campaignId?: string,
  ): Promise<void> {
    try {
      await this.prisma.analyticsEvent.create({
        data: {
          organizationId,
          eventType,
          leadId,
          campaignId,
          data: data as never,
        },
      });
    } catch (error) {
      this.logger.warn({
        message: `Failed to track analytics event: ${eventType}`,
        organizationId,
        error: String(error),
      });
    }
  }

  async trackAIUsage(
    organizationId: string,
    tokensUsed: number,
    model: string,
    stage: string,
  ): Promise<void> {
    await this.track(organizationId, 'ai.tokens_used', { tokensUsed, model, stage });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await this.prisma.usageRecord.upsert({
      where: {
        organizationId_date: { organizationId, date: today },
      },
      update: {
        aiTokensUsed: { increment: BigInt(tokensUsed) },
      },
      create: {
        organizationId,
        date: today,
        aiTokensUsed: BigInt(tokensUsed),
        leadsProcessed: 0,
        scrapesExecuted: 0,
      },
    });
  }
}
