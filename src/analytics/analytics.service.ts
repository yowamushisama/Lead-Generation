import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { UsageMeteringService } from './usage-metering.service';

@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usageMetering: UsageMeteringService,
  ) {}

  async getDashboard(tenant: TenantContext) {
    const { organizationId } = tenant;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [leadsByStatus, leadsByTier, messageStats, monthlyUsage] = await Promise.all([
      this.prisma.lead.groupBy({
        by: ['status'],
        where: { organizationId, createdAt: { gte: thirtyDaysAgo } },
        _count: { id: true },
      }),
      this.prisma.lead.groupBy({
        by: ['tier'],
        where: { organizationId, createdAt: { gte: thirtyDaysAgo } },
        _count: { id: true },
      }),
      this.prisma.message.groupBy({
        by: ['status'],
        where: { organizationId, createdAt: { gte: thirtyDaysAgo } },
        _count: { id: true },
      }),
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

    const stages = [
      'NEW',
      'ENRICHED',
      'SCORED',
      'PERSONALIZED',
      'MESSAGE_DRAFTED',
      'MESSAGE_APPROVED',
      'OUTREACH_SENT',
      'REPLIED',
      'MEETING_BOOKED',
      'CONVERTED',
    ];

    const counts = await this.prisma.lead.groupBy({
      by: ['status'],
      where: { organizationId },
      _count: { id: true },
    });

    const countMap: Record<string, number> = {};
    for (const c of counts) countMap[c.status] = c._count.id;

    return stages.map((stage, i) => ({
      stage,
      count: countMap[stage] ?? 0,
      dropOff: i > 0 ? Math.max(0, (countMap[stages[i - 1]] ?? 0) - (countMap[stage] ?? 0)) : 0,
    }));
  }

  async getLeadSourceBreakdown(tenant: TenantContext) {
    const results = await this.prisma.lead.groupBy({
      by: ['source'],
      where: { organizationId: tenant.organizationId },
      _count: { id: true },
      orderBy: { _count: { source: 'desc' } },
    });
    return results.map((r) => ({ source: r.source, count: r._count.id }));
  }

  async getDailyTrend(tenant: TenantContext, days = 14) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    return this.prisma.usageRecord.findMany({
      where: { organizationId: tenant.organizationId, date: { gte: since } },
      orderBy: { date: 'asc' },
      select: { date: true, leadsProcessed: true, aiTokensUsed: true },
    });
  }
}
