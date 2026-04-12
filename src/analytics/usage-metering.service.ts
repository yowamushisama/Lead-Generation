import { Injectable, Logger } from '@nestjs/common';
import { OrganizationRepository } from '../database/repositories/organization.repository';
import { UsageRecordRepository } from '../database/repositories/usage-record.repository';

@Injectable()
export class UsageMeteringService {
  private readonly logger = new Logger(UsageMeteringService.name);

  constructor(
    private readonly usageRecordRepository: UsageRecordRepository,
    private readonly organizationRepository: OrganizationRepository,
  ) {}

  async getDailyUsage(organizationId: string, date?: Date) {
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    return this.usageRecordRepository.findUnique({
      where: { organizationId_date: { organizationId, date: targetDate } },
    });
  }

  async getMonthlyUsage(organizationId: string) {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const records = await this.usageRecordRepository.findMany({
      where: { organizationId, date: { gte: startOfMonth } },
    });

    return records.reduce(
      (totals: any, r: any) => ({
        aiTokensUsed: totals.aiTokensUsed + Number(r.aiTokensUsed),
        leadsProcessed: totals.leadsProcessed + r.leadsProcessed,
        scrapesExecuted: totals.scrapesExecuted + r.scrapesExecuted,
      }),
      { aiTokensUsed: 0, leadsProcessed: 0, scrapesExecuted: 0 },
    );
  }

  async checkQuota(organizationId: string): Promise<{ withinLimits: boolean; reason?: string }> {
    const org = await this.organizationRepository.findUnique({ where: { id: organizationId } });
    if (!org) return { withinLimits: false, reason: 'Organization not found' };

    const daily = await this.getDailyUsage(organizationId);
    const monthly = await this.getMonthlyUsage(organizationId);

    if (daily && daily.leadsProcessed >= org.maxLeadsPerDay) {
      return { withinLimits: false, reason: `Daily lead limit reached (${org.maxLeadsPerDay})` };
    }

    const monthlyTokenLimit = Number(org.maxAiTokensPerMonth);
    if (monthly.aiTokensUsed >= monthlyTokenLimit) {
      return {
        withinLimits: false,
        reason: `Monthly AI token limit reached (${monthlyTokenLimit})`,
      };
    }

    return { withinLimits: true };
  }

  async incrementLeadsProcessed(organizationId: string): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    await this.usageRecordRepository.upsert({
      where: { organizationId_date: { organizationId, date: today } },
      update: { leadsProcessed: { increment: 1 } },
      create: {
        organizationId,
        date: today,
        aiTokensUsed: BigInt(0),
        leadsProcessed: 1,
        scrapesExecuted: 0,
      },
    });
  }
}
