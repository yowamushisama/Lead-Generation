import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CampaignRepository } from '../database/repositories/campaign.repository';
import { LeadRepository } from '../database/repositories/lead.repository';
import { MessageRepository } from '../database/repositories/message.repository';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { CampaignFilterDto } from './dto/campaign-filter.dto';

export interface CampaignWithMetrics {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  icpProfileId: string | null;
  status: string;
  isActive: boolean;
  settings: Prisma.JsonValue;
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
  ) {}

  async create(tenant: TenantContext, dto: CreateCampaignDto): Promise<CampaignWithMetrics> {
    const campaign = await this.campaignRepository.create({
      data: {
        organizationId: tenant.organizationId,
        name: dto.name,
        description: dto.description,
        icpProfileId: dto.icpProfileId,
        settings: {
          maxLeadsPerDay: dto.maxLeadsPerDay ?? 50,
          targetSources: dto.targetSources ?? [],
          targetIndustry: dto.targetIndustry,
          targetLocation: dto.targetLocation,
          minIntentConfidence: dto.minIntentConfidence ?? 0.7,
          autoApproveWarm: dto.autoApproveWarm ?? false,
        },
        isActive: true,
        status: 'ACTIVE',
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
      },
    });
    if (!campaign) throw new NotFoundException(`Campaign ${id} not found`);

    const [result] = await this.attachMetrics(tenant.organizationId, [campaign]);
    return result;
  }

  async update(tenant: TenantContext, id: string, dto: Partial<CreateCampaignDto>): Promise<CampaignWithMetrics> {
    await this.findOne(tenant, id);

    const data: Record<string, unknown> = {};
    if (dto.name) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.icpProfileId !== undefined) data.icpProfileId = dto.icpProfileId;

    await this.campaignRepository.update({ where: { id }, data: data as never });
    return this.findOne(tenant, id);
  }

  async pause(tenant: TenantContext, id: string): Promise<CampaignWithMetrics> {
    await this.findOne(tenant, id);
    await this.campaignRepository.update({
      where: { id },
      data: { status: 'PAUSED', isActive: false },
    });
    return this.findOne(tenant, id);
  }

  async resume(tenant: TenantContext, id: string): Promise<CampaignWithMetrics> {
    await this.findOne(tenant, id);
    await this.campaignRepository.update({
      where: { id },
      data: { status: 'ACTIVE', isActive: true },
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
