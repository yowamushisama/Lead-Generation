import { Injectable, Logger } from '@nestjs/common';
import { IPipelineStage } from '../../common/interfaces/pipeline-stage.interface';
import { TenantContext } from '../../common/interfaces/tenant-context.interface';
import { PrismaService } from '../../database/prisma.service';

export interface ICPRefinerInput {
  organizationId: string;
  icpProfileId: string;
  convertedLeadAttributes: Array<{
    role?: string;
    industry?: string;
    companyStage?: string;
    intentConfidence: number;
    score: number;
  }>;
}

export interface ICPRefinerOutput {
  icpProfileId: string;
  updatedWeights: Record<string, number>;
  conversionRate: number;
  version: number;
}

@Injectable()
export class ICPRefinerStage implements IPipelineStage<ICPRefinerInput, ICPRefinerOutput> {
  readonly stageName = 'icp-refiner';
  private readonly logger = new Logger(ICPRefinerStage.name);

  constructor(private readonly prisma: PrismaService) {}

  async process(input: ICPRefinerInput, context: TenantContext): Promise<ICPRefinerOutput> {
    const profile = await this.prisma.iCPProfile.findFirst({
      where: { id: input.icpProfileId, organizationId: context.organizationId },
    });

    if (!profile) {
      throw new Error(`ICP profile ${input.icpProfileId} not found`);
    }

    // Aggregate conversion signals from converted leads
    const roleCounts: Record<string, number> = {};
    const industryCounts: Record<string, number> = {};
    const stageCounts: Record<string, number> = {};

    for (const lead of input.convertedLeadAttributes) {
      if (lead.role) roleCounts[lead.role] = (roleCounts[lead.role] ?? 0) + 1;
      if (lead.industry) industryCounts[lead.industry] = (industryCounts[lead.industry] ?? 0) + 1;
      if (lead.companyStage) stageCounts[lead.companyStage] = (stageCounts[lead.companyStage] ?? 0) + 1;
    }

    const currentWeights = (profile.learnedWeights as Record<string, number>) ?? {};
    const total = input.convertedLeadAttributes.length;

    // Blend existing weights with new conversion data (0.7 existing + 0.3 new)
    const newWeights: Record<string, number> = { ...currentWeights };
    for (const [role, count] of Object.entries(roleCounts)) {
      const newWeight = count / total;
      newWeights[`role:${role}`] = (currentWeights[`role:${role}`] ?? 0) * 0.7 + newWeight * 0.3;
    }
    for (const [industry, count] of Object.entries(industryCounts)) {
      const newWeight = count / total;
      newWeights[`industry:${industry}`] =
        (currentWeights[`industry:${industry}`] ?? 0) * 0.7 + newWeight * 0.3;
    }

    const conversionRate = total > 0 ? total / Math.max(total * 10, 1) : profile.conversionRate ?? 0;

    const updated = await this.prisma.iCPProfile.update({
      where: { id: input.icpProfileId },
      data: {
        learnedWeights: newWeights,
        conversionRate,
        version: { increment: 1 },
      },
    });

    this.logger.log({
      message: `ICP profile ${input.icpProfileId} refined from ${total} conversions`,
      organizationId: context.organizationId,
      version: updated.version,
    });

    return {
      icpProfileId: input.icpProfileId,
      updatedWeights: newWeights,
      conversionRate,
      version: updated.version,
    };
  }
}
