import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ICPConfig } from '../common/types/icp.types';

@Injectable()
export class ICPLearningService {
  private readonly logger = new Logger(ICPLearningService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Analyze converted leads and update learned weights for the active ICP profile.
   * Called weekly by the icp-refinement cron job.
   */
  async refineFromConversions(organizationId: string): Promise<void> {
    const profile = await this.prisma.iCPProfile.findFirst({
      where: { organizationId, isActive: true },
    });

    if (!profile) {
      this.logger.warn({ message: 'No active ICP profile to refine', organizationId });
      return;
    }

    const convertedLeads = await this.prisma.lead.findMany({
      where: { organizationId, status: 'CONVERTED' },
      select: { role: true, industry: true, icpAttributes: true, score: true },
      take: 200,
    });

    if (convertedLeads.length === 0) {
      this.logger.log({ message: 'No converted leads to learn from', organizationId });
      return;
    }

    const weights: Record<string, number> =
      (profile.learnedWeights as Record<string, number>) ?? {};
    const total = convertedLeads.length;

    const roleCounts: Record<string, number> = {};
    const industryCounts: Record<string, number> = {};

    for (const lead of convertedLeads) {
      if (lead.role) roleCounts[lead.role] = (roleCounts[lead.role] ?? 0) + 1;
      if (lead.industry) industryCounts[lead.industry] = (industryCounts[lead.industry] ?? 0) + 1;
    }

    for (const [role, count] of Object.entries(roleCounts)) {
      const frequency = count / total;
      weights[`role:${role}`] = (weights[`role:${role}`] ?? 0) * 0.7 + frequency * 0.3;
    }

    for (const [industry, count] of Object.entries(industryCounts)) {
      const frequency = count / total;
      weights[`industry:${industry}`] =
        (weights[`industry:${industry}`] ?? 0) * 0.7 + frequency * 0.3;
    }

    // Surface new top signals and recommend adding to ICP config
    const topRoles = Object.entries(roleCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([role]) => role);

    const config = profile.config as unknown as ICPConfig;
    const newRoles = topRoles.filter((r) => !config.targetRoles.includes(r));
    if (newRoles.length > 0) {
      this.logger.log({
        message: `ICP learning: recommend adding roles to ICP config`,
        organizationId,
        suggestedRoles: newRoles,
      });
    }

    await this.prisma.iCPProfile.update({
      where: { id: profile.id },
      data: {
        learnedWeights: weights,
        conversionRate: total / Math.max(total + 100, 1),
        version: { increment: 1 },
      },
    });

    this.logger.log({
      message: `ICP refined from ${total} conversions`,
      organizationId,
      profileId: profile.id,
    });
  }
}
