import { Injectable, NotFoundException, Logger, InternalServerErrorException } from '@nestjs/common';
import { IcpProfileRepository } from '../database/repositories/icp-profile.repository';
import { IcpProfileChangeLogRepository } from '../database/repositories/icp-profile-change-log.repository';
import { LeadRepository } from '../database/repositories/lead.repository';
import { PrismaService } from '../database/prisma.service';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { ICPConfig, ICPMatch } from '../common/types/icp.types';
import { AIProviderFactory } from '../ai/ai-provider.factory';
import {
  ICP_ENHANCE_SYSTEM_PROMPT,
  VALID_ICP_STAGES,
  buildICPEnhancePrompt,
} from '../ai/prompts/icp-enhance.prompt';
import { CreateICPDto } from './dto/create-icp.dto';
import { UpdateICPDto } from './dto/update-icp.dto';
import { resolveICPField, diffICPFields } from './icp-change-log.utils';

export { CreateICPDto, UpdateICPDto };

@Injectable()
export class ICPService {
  private readonly logger = new Logger(ICPService.name);

  private static readonly MAX_ENHANCE_RETRIES = 2;

  constructor(
    private readonly icpProfileRepository: IcpProfileRepository,
    private readonly icpChangeLogRepository: IcpProfileChangeLogRepository,
    private readonly leadRepository: LeadRepository,
    private readonly prisma: PrismaService,
    private readonly aiFactory: AIProviderFactory,
  ) {}

  async create(tenant: TenantContext, dto: CreateICPDto) {
    return this.icpProfileRepository.create({
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
    return this.icpProfileRepository.findMany({
      where: { organizationId: tenant.organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findActive(organizationId: string) {
    return this.icpProfileRepository.findFirst({
      where: { organizationId, isActive: true },
      orderBy: { version: 'desc' },
    });
  }

  async findOne(tenant: TenantContext, id: string) {
    const profile = await this.icpProfileRepository.findFirst({
      where: { id, organizationId: tenant.organizationId },
    });
    if (!profile) throw new NotFoundException(`ICP profile ${id} not found`);
    return profile;
  }

  async update(tenant: TenantContext, id: string, dto: UpdateICPDto) {
    const existing = await this.findOne(tenant, id);

    // Shallow-merge config, but deep-merge sourceFilters.googleMaps to avoid clobbering
    // unrelated per-source blocks when only one filter field is updated.
    let mergedConfig: object;
    if (dto.config !== undefined) {
      const existingConfig = (existing.config as Record<string, unknown>) ?? {};
      const patchConfig = dto.config as Record<string, unknown>;
      const mergedSourceFilters =
        patchConfig['sourceFilters'] !== undefined
          ? {
              ...((existingConfig['sourceFilters'] as Record<string, unknown>) ?? {}),
              ...((patchConfig['sourceFilters'] as Record<string, unknown>) ?? {}),
              googleMaps:
                (patchConfig['sourceFilters'] as any)?.googleMaps !== undefined
                  ? {
                      ...((existingConfig['sourceFilters'] as any)?.googleMaps ?? {}),
                      ...((patchConfig['sourceFilters'] as any).googleMaps ?? {}),
                    }
                  : (existingConfig['sourceFilters'] as any)?.googleMaps,
            }
          : existingConfig['sourceFilters'];
      mergedConfig = {
        ...existingConfig,
        ...patchConfig,
        ...(mergedSourceFilters !== undefined ? { sourceFilters: mergedSourceFilters } : {}),
      };
    } else {
      mergedConfig = existing.config as object ?? {};
    }

    const updateData: Record<string, unknown> = {};
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    if (dto.config !== undefined) {
      updateData.config = mergedConfig;
      updateData.version = { increment: 1 };
    }

    const fromVersion = existing.version;
    const toVersion = dto.config !== undefined ? fromVersion + 1 : fromVersion;

    // Diff effective resolved values (top-level column OR config.*) for tracked fields.
    const simulatedAfter = { ...existing, ...updateData, config: mergedConfig };
    const tracked = ['targetIndustries', 'targetLocations', 'buyerSignals', 'urgencySignals'];
    const changes = diffICPFields(existing, simulatedAfter, tracked);

    // Diff sourceFilters.googleMaps with a one-off explicit path (resolveICPField only does top-level).
    const prevGmaps = (existing.config as any)?.sourceFilters?.googleMaps;
    const nextGmaps = (mergedConfig as any)?.sourceFilters?.googleMaps;
    if (JSON.stringify(prevGmaps) !== JSON.stringify(nextGmaps)) {
      changes.push({ field: 'sourceFilters.googleMaps', before: prevGmaps ?? null, after: nextGmaps ?? null });
    }

    // Also log raw config blob if it changed (fieldName='config' gives a full before/after snapshot).
    if (dto.config !== undefined && JSON.stringify(existing.config) !== JSON.stringify(mergedConfig)) {
      changes.push({ field: 'config', before: existing.config, after: mergedConfig });
    }

    return this.prisma.$transaction(async (tx) => {
      if (changes.length > 0) {
        await this.icpChangeLogRepository.createMany(
          tx as any,
          changes.map((c) => ({
            profileId: id,
            organizationId: tenant.organizationId,
            changedBy: (tenant as any).userId ?? null,
            fieldName: c.field,
            beforeValue: c.before,
            afterValue: c.after,
            fromVersion,
            toVersion,
          })),
        );
      }
      return (tx as any).iCPProfile.update({ where: { id }, data: updateData });
    });
  }

  async matchLead(
    organizationId: string,
    leadAttributes: { role?: string; industry?: string; companyStage?: string; location?: string },
  ): Promise<ICPMatch> {
    const profile = await this.findActive(organizationId);
    if (!profile) {
      return {
        isMatch: false,
        matchScore: 0,
        matchedSignals: [],
        missedSignals: [],
        reasoning: 'No active ICP profile',
      };
    }

    const config = profile.config as unknown as ICPConfig;
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

  async enhance(profileName: string): Promise<ICPConfig> {
    const prompt = buildICPEnhancePrompt(profileName);
    let lastError: unknown;

    const provider = this.aiFactory.getProvider();

    for (let attempt = 0; attempt <= ICPService.MAX_ENHANCE_RETRIES; attempt++) {
      const result = await provider.complete(prompt, {
        systemPrompt: ICP_ENHANCE_SYSTEM_PROMPT,
        temperature: 0.4,
        maxTokens: 800,
      });

      let parsed: Partial<ICPConfig>;
      try {
        parsed = JSON.parse(result.content) as Partial<ICPConfig>;
      } catch (err) {
        lastError = err;
        this.logger.warn({
          message: `ICP enhance JSON parse failed (attempt ${attempt + 1}/${ICPService.MAX_ENHANCE_RETRIES + 1})`,
          profileName,
          raw: result.content.slice(0, 200),
        });
        continue;
      }

      const toStrings = (val: unknown): string[] =>
        Array.isArray(val) ? val.filter((e): e is string => typeof e === 'string') : [];

      return {
        targetRoles:      toStrings(parsed.targetRoles),
        targetIndustries: toStrings(parsed.targetIndustries),
        targetLocations:  toStrings(parsed.targetLocations),
        targetStages:     toStrings(parsed.targetStages).filter(
          (s) => (VALID_ICP_STAGES as readonly string[]).includes(s),
        ),
        buyerSignals:     toStrings(parsed.buyerSignals),
        urgencySignals:   toStrings(parsed.urgencySignals),
        budgetSignals:    toStrings(parsed.budgetSignals),
      };
    }

    this.logger.error({
      message: `ICP enhance failed after all retries`,
      profileName,
      error: lastError,
    });
    throw new InternalServerErrorException(
      'AI enhancement failed to produce valid JSON after multiple attempts. Please try again.',
    );
  }

  async getStats(tenant: TenantContext, id: string) {
    const profile = await this.findOne(tenant, id);

    const [totalLeads, convertedLeads] = await Promise.all([
      this.leadRepository.count({ where: { organizationId: tenant.organizationId } }),
      this.leadRepository.count({
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
