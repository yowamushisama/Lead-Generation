import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { ICPConfig, ICPMatch } from '../common/types/icp.types';

export interface CreateICPDto {
  name: string;
  config: ICPConfig;
}

export interface UpdateICPDto {
  name?: string;
  config?: Partial<ICPConfig>;
  isActive?: boolean;
}

@Injectable()
export class ICPService {
  private readonly logger = new Logger(ICPService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(tenant: TenantContext, dto: CreateICPDto) {
    return this.prisma.iCPProfile.create({
      data: {
        organizationId: tenant.organizationId,
        name: dto.name,
        config: dto.config as never,
        version: 1,
        isActive: true,
      },
    });
  }

  async findAll(tenant: TenantContext) {
    return this.prisma.iCPProfile.findMany({
      where: { organizationId: tenant.organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findActive(organizationId: string) {
    return this.prisma.iCPProfile.findFirst({
      where: { organizationId, isActive: true },
      orderBy: { version: 'desc' },
    });
  }

  async findOne(tenant: TenantContext, id: string) {
    const profile = await this.prisma.iCPProfile.findFirst({
      where: { id, organizationId: tenant.organizationId },
    });
    if (!profile) throw new NotFoundException(`ICP profile ${id} not found`);
    return profile;
  }

  async update(tenant: TenantContext, id: string, dto: UpdateICPDto) {
    await this.findOne(tenant, id);

    const updateData: Record<string, unknown> = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    if (dto.config !== undefined) {
      // Merge config
      const existing = await this.findOne(tenant, id);
      updateData.config = { ...((existing.config as unknown) as ICPConfig), ...dto.config };
      updateData.version = { increment: 1 };
    }

    return this.prisma.iCPProfile.update({ where: { id }, data: updateData as never });
  }

  async matchLead(
    organizationId: string,
    leadAttributes: { role?: string; industry?: string; companyStage?: string; location?: string },
  ): Promise<ICPMatch> {
    const profile = await this.findActive(organizationId);
    if (!profile) {
      return { isMatch: false, matchScore: 0, matchedSignals: [], missedSignals: [], reasoning: 'No active ICP profile' };
    }

    const config = (profile.config as unknown) as ICPConfig;
    const learnedWeights = (profile.learnedWeights as Record<string, number>) ?? {};
    const matched: string[] = [];
    const missed: string[] = [];
    let score = 0;
    const maxScore = 4;

    const normalize = (s?: string | null) => (s ?? '').toLowerCase();

    // Role
    const roleMatch = config.targetRoles.find((r) =>
      normalize(leadAttributes.role).includes(r.toLowerCase()),
    );
    if (roleMatch) {
      score += 1 + (learnedWeights[`role:${roleMatch}`] ?? 0);
      matched.push(`role: ${roleMatch}`);
    } else {
      missed.push(`role not in ICP: ${leadAttributes.role ?? 'unknown'}`);
    }

    // Industry
    const industryMatch = config.targetIndustries.find((i) =>
      normalize(leadAttributes.industry).includes(i.toLowerCase()),
    );
    if (industryMatch) {
      score += 1 + (learnedWeights[`industry:${industryMatch}`] ?? 0);
      matched.push(`industry: ${industryMatch}`);
    } else {
      missed.push(`industry not in ICP: ${leadAttributes.industry ?? 'unknown'}`);
    }

    // Stage
    const stageMatch = config.targetStages.find((s) =>
      normalize(leadAttributes.companyStage).includes(s.toLowerCase()),
    );
    if (stageMatch) {
      score += 1;
      matched.push(`stage: ${stageMatch}`);
    } else {
      missed.push(`stage not in ICP: ${leadAttributes.companyStage ?? 'unknown'}`);
    }

    // Excluded industry check
    const excluded = config.excludedIndustries?.find((e) =>
      normalize(leadAttributes.industry).includes(e.toLowerCase()),
    );
    if (excluded) {
      score -= 2;
      missed.push(`EXCLUDED industry: ${excluded}`);
    }

    const normalizedScore = Math.min(1, Math.max(0, score / maxScore));

    return {
      isMatch: normalizedScore >= 0.5,
      matchScore: normalizedScore,
      matchedSignals: matched,
      missedSignals: missed,
      reasoning: `Score: ${score}/${maxScore} — ${matched.length} signals matched`,
    };
  }

  async getStats(tenant: TenantContext, id: string) {
    const profile = await this.findOne(tenant, id);

    const [totalLeads, convertedLeads] = await Promise.all([
      this.prisma.lead.count({ where: { organizationId: tenant.organizationId } }),
      this.prisma.lead.count({
        where: { organizationId: tenant.organizationId, status: 'CONVERTED' },
      }),
    ]);

    return {
      profile,
      stats: {
        totalLeads,
        convertedLeads,
        conversionRate: totalLeads > 0 ? convertedLeads / totalLeads : 0,
        version: profile.version,
        learnedWeightsCount: Object.keys((profile.learnedWeights as object) ?? {}).length,
      },
    };
  }
}
