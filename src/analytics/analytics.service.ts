import { Injectable } from '@nestjs/common';
import { LeadRepository } from '../database/repositories/lead.repository';
import { MessageRepository } from '../database/repositories/message.repository';
import { UsageRecordRepository } from '../database/repositories/usage-record.repository';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { LEAD_FUNNEL_STAGES } from '../common/constants/lead-funnel-stages';
import { UsageMeteringService } from './usage-metering.service';

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly leadRepository: LeadRepository,
    private readonly messageRepository: MessageRepository,
    private readonly usageRecordRepository: UsageRecordRepository,
    private readonly usageMetering: UsageMeteringService,
  ) {}

  async getDashboard(tenant: TenantContext) {
    const { organizationId } = tenant;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [leadsByStatus, leadsByTier, messageStats, monthlyUsage] = await Promise.all([
      this.leadRepository.countByStatus({ organizationId, createdAt: { gte: thirtyDaysAgo } }),
      this.leadRepository.countByTier({ organizationId, createdAt: { gte: thirtyDaysAgo } }),
      this.messageRepository.countByStatus({ organizationId, createdAt: { gte: thirtyDaysAgo } }),
      this.usageMetering.getMonthlyUsage(organizationId),
    ]);

    const statusMap: Record<string, number> = {};
    for (const s of leadsByStatus) statusMap[s.status] = s._count.id;

    const tierMap: Record<string, number> = {};
    for (const t of leadsByTier) tierMap[t.tier] = t._count.id;

    const msgMap: Record<string, number> = {};
    for (const m of messageStats) msgMap[m.status] = m._count.id;

    const totalLeads = Object.values(statusMap).reduce((a, b) => a + b, 0);
    const sent = msgMap['SENT'] ?? 0;
    const replied = statusMap['REPLIED'] ?? 0;
    const converted = statusMap['CONVERTED'] ?? 0;

    return {
      period: '30 days',
      leads: {
        total: totalLeads,
        byStatus: statusMap,
        byTier: tierMap,
        hot: tierMap['HOT'] ?? 0,
        warm: tierMap['WARM'] ?? 0,
        cold: tierMap['COLD'] ?? 0,
      },
      outreach: {
        messagesSent: sent,
        replyRate: sent > 0 ? replied / sent : 0,
        conversionRate: totalLeads > 0 ? converted / totalLeads : 0,
        byStatus: msgMap,
      },
      usage: monthlyUsage,
    };
  }

  async getFunnel(tenant: TenantContext) {
    const { organizationId } = tenant;

    const counts = await this.leadRepository.countByStatus({ organizationId });

    const countMap: Record<string, number> = {};
    for (const c of counts) countMap[c.status] = c._count.id;

    return LEAD_FUNNEL_STAGES.map((stage, i) => ({
      stage,
      count: countMap[stage] ?? 0,
      dropOff:
        i > 0
          ? Math.max(
              0,
              (countMap[LEAD_FUNNEL_STAGES[i - 1]] ?? 0) - (countMap[stage] ?? 0),
            )
          : 0,
    }));
  }

  async getLeadSourceBreakdown(tenant: TenantContext) {
    const results = await this.leadRepository.countBySource({ organizationId: tenant.organizationId });
    return results
      .map((r) => ({ source: r.source, count: r._count.id }))
      .sort((a, b) => b.count - a.count);
  }

  async getDailyTrend(tenant: TenantContext, days = 14) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    return this.usageRecordRepository.findMany({
      where: { organizationId: tenant.organizationId, date: { gte: since } },
      orderBy: { date: 'asc' },
      select: { date: true, leadsProcessed: true, aiTokensUsed: true },
    });
  }
}
