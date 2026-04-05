import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { CampaignFilterDto } from './dto/campaign-filter.dto';

@Injectable()
export class CampaignsService {
  private readonly logger = new Logger(CampaignsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(tenant: TenantContext, dto: CreateCampaignDto) {
    return this.prisma.campaign.create({
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
  }

  async findAll(tenant: TenantContext, filters: CampaignFilterDto) {
    return this.prisma.campaign.findMany({
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
  }

  async findOne(tenant: TenantContext, id: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id, organizationId: tenant.organizationId },
      include: {
        _count: { select: { leads: true, messages: true } },
      },
    });
    if (!campaign) throw new NotFoundException(`Campaign ${id} not found`);
    return campaign;
  }

  async update(tenant: TenantContext, id: string, dto: Partial<CreateCampaignDto>) {
    await this.findOne(tenant, id);

    const data: Record<string, unknown> = {};
    if (dto.name) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.icpProfileId !== undefined) data.icpProfileId = dto.icpProfileId;

    return this.prisma.campaign.update({ where: { id }, data: data as never });
  }

  async pause(tenant: TenantContext, id: string) {
    await this.findOne(tenant, id);
    return this.prisma.campaign.update({
      where: { id },
      data: { status: 'PAUSED', isActive: false },
    });
  }

  async resume(tenant: TenantContext, id: string) {
    await this.findOne(tenant, id);
    return this.prisma.campaign.update({
      where: { id },
      data: { status: 'ACTIVE', isActive: true },
    });
  }

  async getPerformance(tenant: TenantContext, id: string) {
    await this.findOne(tenant, id);

    const [leads, messages] = await Promise.all([
      this.prisma.lead.groupBy({
        by: ['status'],
        where: { campaignId: id, organizationId: tenant.organizationId },
        _count: true,
      }),
      this.prisma.message.groupBy({
        by: ['status'],
        where: { campaignId: id, organizationId: tenant.organizationId },
        _count: true,
      }),
    ]);

    const leadMap: Record<string, number> = {};
    for (const l of leads) leadMap[l.status] = l._count;

    const messageMap: Record<string, number> = {};
    for (const m of messages) messageMap[m.status] = m._count;

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
}
