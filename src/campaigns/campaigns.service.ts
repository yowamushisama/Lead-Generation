import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CampaignRepository } from '../database/repositories/campaign.repository';
import { LeadRepository } from '../database/repositories/lead.repository';
import { MessageRepository } from '../database/repositories/message.repository';
import { IcpProfileRepository } from '../database/repositories/icp-profile.repository';
import { PrismaService } from '../database/prisma.service';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { ICPConfig } from '../common/types/icp.types';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { CampaignFilterDto } from './dto/campaign-filter.dto';
import { sanitizePromptConfigOverrides } from '../prompt-config/prompt-config-overrides.util';
import { CampaignRunnerService, CampaignRunSummary } from './campaign-runner.service';

export interface CampaignWithMetrics {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  icpProfileId: string | null;
  status: string;
  isActive: boolean;
  settings: Prisma.JsonValue;
  promptConfigId: string | null;
  promptOverrides: Prisma.JsonValue;
  promptConfig: { id: string; name: string; version: number } | null;
  createdAt: Date;
  updatedAt: Date;
  leadsGenerated: number;
  messagesSent: number;
  replies: number;
  conversions: number;
  meetings: number;
}

@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name);

  constructor(
    private readonly campaignRepository: CampaignRepository,
    private readonly leadRepository: LeadRepository,
    private readonly messageRepository: MessageRepository,
    private readonly icpProfileRepository: IcpProfileRepository,
    private readonly prisma: PrismaService,
    private readonly campaignRunner: CampaignRunnerService,
  ) {}

  async create(tenant: TenantContext, dto: CreateCampaignDto): Promise<CampaignWithMetrics> {
    // Verify ICP profile belongs to this tenant and derive targeting from it
    const icp = await this.icpProfileRepository.findFirst({
      where: { id: dto.icpProfileId, organizationId: tenant.organizationId },
    });
    if (!icp) {
      throw new NotFoundException(`ICP profile ${dto.icpProfileId} not found`);
    }

    const icpConfig = icp.config as ICPConfig | null;
    const keywords = [
      ...((icp.buyerSignals as string[] | null) ?? icpConfig?.buyerSignals ?? []),
      ...((icp.urgencySignals as string[] | null) ?? icpConfig?.urgencySignals ?? []),
    ].filter((v, i, a) => a.indexOf(v) === i);
    const targetLocations = (icp.targetLocations as string[] | null) ?? icpConfig?.targetLocations ?? [];
    const targetIndustries = (icp.targetIndustries as string[] | null) ?? icpConfig?.targetIndustries ?? [];

    // Derive autoApproveWarm from approvalMode for backwards compat
    const autoApproveWarm =
      dto.autoApproveWarm ?? (dto.approvalMode ? dto.approvalMode !== 'manual' : false);

    const isDraft = dto.startAsDraft === true;
    const promptConfigId = await this.resolvePromptConfigId(tenant, dto.promptConfigId);
    const promptOverrides = this.serializePromptOverrides(dto.promptOverrides);

    const campaign = await this.campaignRepository.create({
      data: {
        organizationId: tenant.organizationId,
        name: dto.name,
        description: dto.description,
        icpProfileId: dto.icpProfileId,
        promptConfigId,
        promptOverrides,
        keywords,
        targetLocations,
        targetIndustries,
        settings: {
          maxLeadsPerDay: dto.maxLeadsPerDay ?? 50,
          maxOutreachPerDay: dto.maxOutreachPerDay ?? 20,
          targetSources: dto.targetSources ?? [],
          minIntentConfidence: dto.minIntentConfidence ?? 0.7,
          autoApproveWarm,
          objective: dto.objective,
          serviceType: dto.serviceType,
          linkedChannels: dto.linkedChannels ?? [],
          outreachTone: dto.outreachTone ?? 'professional',
          approvalMode: dto.approvalMode ?? 'manual',
          campaignTrack: dto.campaignTrack ?? null,
        },
        isActive: !isDraft,
        status: isDraft ? 'DRAFT' : 'ACTIVE',
      },
    });
    return this.findOne(tenant, campaign.id);
  }

  async findAll(tenant: TenantContext, filters: CampaignFilterDto): Promise<CampaignWithMetrics[]> {
    const campaigns = await this.campaignRepository.findMany({
      where: {
        organizationId: tenant.organizationId,
        isActive: filters.isActive,
        status: filters.status,
      },
      include: {
        _count: { select: { leads: true, messages: true } },
        promptConfig: { select: { id: true, name: true, version: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return this.attachMetrics(tenant.organizationId, campaigns);
  }

  async findOne(tenant: TenantContext, id: string): Promise<CampaignWithMetrics> {
    const campaign = await this.campaignRepository.findFirst({
      where: { id, organizationId: tenant.organizationId },
      include: {
        _count: { select: { leads: true, messages: true } },
        promptConfig: { select: { id: true, name: true, version: true } },
      },
    });
    if (!campaign) throw new NotFoundException(`Campaign ${id} not found`);

    const [result] = await this.attachMetrics(tenant.organizationId, [campaign]);
    return result;
  }

  async update(tenant: TenantContext, id: string, dto: Partial<CreateCampaignDto>): Promise<CampaignWithMetrics> {
    const existing = await this.findOne(tenant, id);

    if (existing.status === 'ARCHIVED') {
      throw new ForbiddenException('Archived campaigns are read-only and cannot be modified');
    }

    const topLevelData: Record<string, unknown> = {};
    if (dto.name) topLevelData.name = dto.name;
    if (dto.description !== undefined) topLevelData.description = dto.description;
    if (dto.promptConfigId !== undefined) {
      topLevelData.promptConfigId = await this.resolvePromptConfigId(tenant, dto.promptConfigId);
    }
    if (dto.promptOverrides !== undefined) {
      topLevelData.promptOverrides = this.serializePromptOverrides(dto.promptOverrides);
    }

    // Re-sync targeting when ICP profile changes
    if (dto.icpProfileId !== undefined && dto.icpProfileId !== existing.icpProfileId) {
      const icp = await this.icpProfileRepository.findFirst({
        where: { id: dto.icpProfileId, organizationId: tenant.organizationId },
      });
      if (!icp) throw new NotFoundException(`ICP profile ${dto.icpProfileId} not found`);

      const icpConfig = icp.config as ICPConfig | null;
      const keywords = [
        ...((icp.buyerSignals as string[] | null) ?? icpConfig?.buyerSignals ?? []),
        ...((icp.urgencySignals as string[] | null) ?? icpConfig?.urgencySignals ?? []),
      ].filter((v, i, a) => a.indexOf(v) === i);

      topLevelData.icpProfileId = dto.icpProfileId;
      topLevelData.keywords = keywords;
      topLevelData.targetLocations = (icp.targetLocations as string[] | null) ?? icpConfig?.targetLocations ?? [];
      topLevelData.targetIndustries = (icp.targetIndustries as string[] | null) ?? icpConfig?.targetIndustries ?? [];
    }

    // Merge settings — only update fields that were explicitly provided
    const existingSettings = (existing.settings as Record<string, unknown>) ?? {};
    const settingsPatch: Record<string, unknown> = {};

    if (dto.maxLeadsPerDay !== undefined) settingsPatch.maxLeadsPerDay = dto.maxLeadsPerDay;
    if (dto.maxOutreachPerDay !== undefined) settingsPatch.maxOutreachPerDay = dto.maxOutreachPerDay;
    if (dto.targetSources !== undefined) settingsPatch.targetSources = dto.targetSources;
    if (dto.minIntentConfidence !== undefined) settingsPatch.minIntentConfidence = dto.minIntentConfidence;
    if (dto.objective !== undefined) settingsPatch.objective = dto.objective;
    if (dto.serviceType !== undefined) settingsPatch.serviceType = dto.serviceType;
    if (dto.linkedChannels !== undefined) settingsPatch.linkedChannels = dto.linkedChannels;
    if (dto.outreachTone !== undefined) settingsPatch.outreachTone = dto.outreachTone;
    if (dto.approvalMode !== undefined) {
      settingsPatch.approvalMode = dto.approvalMode;
      settingsPatch.autoApproveWarm = dto.approvalMode !== 'manual';
    }
    if (dto.autoApproveWarm !== undefined) settingsPatch.autoApproveWarm = dto.autoApproveWarm;
    if (dto.campaignTrack !== undefined) settingsPatch.campaignTrack = dto.campaignTrack;

    if (Object.keys(settingsPatch).length > 0) {
      topLevelData.settings = { ...existingSettings, ...settingsPatch };
    }

    if (Object.keys(topLevelData).length > 0) {
      await this.campaignRepository.update({ where: { id }, data: topLevelData as never });
    }

    return this.findOne(tenant, id);
  }

  async pause(tenant: TenantContext, id: string): Promise<CampaignWithMetrics> {
    const campaign = await this.findOne(tenant, id);
    if (campaign.status !== 'ACTIVE') {
      throw new ForbiddenException(`Cannot pause a campaign with status ${campaign.status}`);
    }
    await this.campaignRepository.update({
      where: { id },
      data: { status: 'PAUSED', isActive: false },
    });
    return this.findOne(tenant, id);
  }

  async launch(tenant: TenantContext, id: string): Promise<CampaignWithMetrics> {
    const campaign = await this.findOne(tenant, id);
    if (campaign.status !== 'DRAFT') {
      throw new ForbiddenException(`Cannot launch a campaign with status ${campaign.status}. Only DRAFT campaigns can be launched.`);
    }
    await this.campaignRepository.update({
      where: { id },
      data: { status: 'ACTIVE', isActive: true },
    });
    await this.campaignRunner.runOnActivationIfEnabled(tenant, id);
    return this.findOne(tenant, id);
  }

  async resume(tenant: TenantContext, id: string): Promise<CampaignWithMetrics> {
    const campaign = await this.findOne(tenant, id);
    if (campaign.status !== 'PAUSED') {
      throw new ForbiddenException(`Cannot resume a campaign with status ${campaign.status}. Only PAUSED campaigns can be resumed.`);
    }
    await this.campaignRepository.update({
      where: { id },
      data: { status: 'ACTIVE', isActive: true },
    });
    await this.campaignRunner.runOnActivationIfEnabled(tenant, id);
    return this.findOne(tenant, id);
  }

  async runManually(tenant: TenantContext, id: string): Promise<CampaignRunSummary> {
    const campaign = await this.findOne(tenant, id);
    if (campaign.status !== 'ACTIVE' || !campaign.isActive) {
      throw new ForbiddenException(
        `Cannot run pipeline for campaign with status ${campaign.status}. Campaign must be ACTIVE.`,
      );
    }
    return this.campaignRunner.runCampaign(tenant, id, 'manual');
  }

  async archive(tenant: TenantContext, id: string): Promise<CampaignWithMetrics> {
    await this.findOne(tenant, id);
    await this.campaignRepository.update({
      where: { id },
      data: { status: 'ARCHIVED', isActive: false },
    });
    return this.findOne(tenant, id);
  }

  async getPerformance(tenant: TenantContext, id: string) {
    await this.findOne(tenant, id);

    const [leads, messages] = await Promise.all([
      this.leadRepository.countByStatus({ campaignId: id, organizationId: tenant.organizationId }),
      this.messageRepository.countByStatus({ campaignId: id, organizationId: tenant.organizationId }),
    ]);

    const leadMap: Record<string, number> = {};
    for (const l of leads) leadMap[l.status] = l._count.id;

    const messageMap: Record<string, number> = {};
    for (const m of messages) messageMap[m.status] = m._count.id;

    const totalLeads = Object.values(leadMap).reduce((a, b) => a + b, 0);
    const sent = messageMap['SENT'] ?? 0;
    const replied = leadMap['REPLIED'] ?? 0;
    const converted = leadMap['CONVERTED'] ?? 0;

    return {
      campaignId: id,
      leadsByStatus: leadMap,
      messagesByStatus: messageMap,
      metrics: {
        totalLeads,
        messagesSent: sent,
        replyRate: sent > 0 ? replied / sent : 0,
        conversionRate: totalLeads > 0 ? converted / totalLeads : 0,
      },
    };
  }

  private async resolvePromptConfigId(
    tenant: TenantContext,
    promptConfigId: string | null | undefined,
  ): Promise<string | null> {
    if (promptConfigId === undefined || promptConfigId === null) {
      return null;
    }

    const config = await this.prisma.promptConfig.findFirst({
      where: { id: promptConfigId, organizationId: tenant.organizationId },
      select: { id: true },
    });
    if (!config) {
      throw new NotFoundException(`Prompt config ${promptConfigId} not found`);
    }

    return config.id;
  }

  private serializePromptOverrides(
    overrides: CreateCampaignDto['promptOverrides'],
  ): Prisma.InputJsonValue | typeof Prisma.DbNull {
    const sanitized = sanitizePromptConfigOverrides(overrides);
    return sanitized ? (sanitized as Prisma.InputJsonValue) : Prisma.DbNull;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async attachMetrics(
    organizationId: string,
    campaigns: Array<{
      id: string;
      organizationId: string;
      name: string;
      description: string | null;
      icpProfileId: string | null;
      status: string;
      isActive: boolean;
      settings: Prisma.JsonValue;
      promptConfigId: string | null;
      promptOverrides: Prisma.JsonValue;
      promptConfig: { id: string; name: string; version: number } | null;
      createdAt: Date;
      updatedAt: Date;
      _count: { leads: number; messages: number };
    }>,
  ): Promise<CampaignWithMetrics[]> {
    if (campaigns.length === 0) return [];

    const campaignIds = campaigns.map((c) => c.id);

    // Single grouped query for replied + converted counts across all campaigns
    const leadStats = await this.leadRepository.countByCampaignAndStatus({
        organizationId,
        campaignId: { in: campaignIds },
        status: { in: ['REPLIED', 'CONVERTED'] },
    });

    const statsByCampaign: Record<string, Record<string, number>> = {};
    for (const s of leadStats) {
      if (!s.campaignId) continue;
      statsByCampaign[s.campaignId] ??= {};
      statsByCampaign[s.campaignId][s.status] = s._count.id;
    }

    return campaigns.map(({ _count, ...c }) => ({
      ...c,
      leadsGenerated: _count.leads,
      messagesSent: _count.messages,
      replies: statsByCampaign[c.id]?.['REPLIED'] ?? 0,
      conversions: statsByCampaign[c.id]?.['CONVERTED'] ?? 0,
      meetings: 0,
    }));
  }
}
