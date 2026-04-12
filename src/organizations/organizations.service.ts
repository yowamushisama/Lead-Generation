import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { LeadRepository } from '../database/repositories/lead.repository';
import { OrganizationRepository } from '../database/repositories/organization.repository';
import { UsageRecordRepository } from '../database/repositories/usage-record.repository';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrganizationResponseDto, OrgStatsResponseDto } from './dto/organization-response.dto';

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(
    private readonly organizationRepository: OrganizationRepository,
    private readonly leadRepository: LeadRepository,
    private readonly usageRecordRepository: UsageRecordRepository,
  ) {}

  async create(dto: CreateOrganizationDto): Promise<OrganizationResponseDto> {
    const existing = await this.organizationRepository.findUnique({
      where: { slug: dto.slug },
    });

    if (existing) {
      throw new ConflictException(`Organization slug '${dto.slug}' is already taken`);
    }

    const organization = await this.organizationRepository.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        tier: dto.tier ?? 'free',
        maxLeadsPerDay: dto.maxLeadsPerDay ?? 50,
        serviceOffering: dto.serviceOffering,
        uniqueValue: dto.uniqueValue,
        positioningPrompt: dto.positioningPrompt,
      },
    });

    this.logger.log({
      message: 'Organization created',
      module: 'OrganizationsService',
      organizationId: organization.id,
    });

    return this.toOrganizationDto(organization);
  }

  async findById(id: string): Promise<OrganizationResponseDto> {
    const organization = await this.organizationRepository.findUnique({
      where: { id },
    });

    if (!organization) {
      throw new NotFoundException(`Organization with ID '${id}' not found`);
    }

    return this.toOrganizationDto(organization);
  }

  async findBySlug(slug: string): Promise<OrganizationResponseDto> {
    const organization = await this.organizationRepository.findUnique({
      where: { slug },
    });

    if (!organization) {
      throw new NotFoundException(`Organization with slug '${slug}' not found`);
    }

    return this.toOrganizationDto(organization);
  }

  async update(id: string, dto: UpdateOrganizationDto): Promise<OrganizationResponseDto> {
    await this.findById(id);

    if (dto.slug) {
      const existing = await this.organizationRepository.findFirst({
        where: { slug: dto.slug, NOT: { id } },
      });

      if (existing) {
        throw new ConflictException(`Organization slug '${dto.slug}' is already taken`);
      }
    }

    const updated = await this.organizationRepository.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.slug && { slug: dto.slug }),
        ...(dto.tier && { tier: dto.tier }),
        ...(dto.maxLeadsPerDay !== undefined && { maxLeadsPerDay: dto.maxLeadsPerDay }),
        ...(dto.serviceOffering !== undefined && { serviceOffering: dto.serviceOffering }),
        ...(dto.uniqueValue !== undefined && { uniqueValue: dto.uniqueValue }),
        ...(dto.positioningPrompt !== undefined && { positioningPrompt: dto.positioningPrompt }),
        ...(dto.classificationModel && { classificationModel: dto.classificationModel }),
        ...(dto.personalizationModel && { personalizationModel: dto.personalizationModel }),
      },
    });

    this.logger.log({
      message: 'Organization updated',
      module: 'OrganizationsService',
      organizationId: id,
    });

    return this.toOrganizationDto(updated);
  }

  async getStats(organizationId: string): Promise<OrgStatsResponseDto> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [organization, leadsToday, totalLeads, hotLeads, usageRecord] = await Promise.all([
      this.organizationRepository.findUnique({ where: { id: organizationId } }),
      this.leadRepository.count({
        where: { organizationId, createdAt: { gte: today } },
      }),
      this.leadRepository.count({ where: { organizationId } }),
      this.leadRepository.count({ where: { organizationId, tier: 'HOT' } }),
      this.usageRecordRepository.findFirst({
        where: { organizationId, date: today },
      }),
    ]);

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    return {
      organization: {
        id: organization.id,
        name: organization.name,
        tier: organization.tier,
        maxLeadsPerDay: organization.maxLeadsPerDay,
      },
      leads: {
        today: leadsToday,
        total: totalLeads,
        hot: hotLeads,
        remainingToday: Math.max(0, organization.maxLeadsPerDay - leadsToday),
      },
      usage: usageRecord
        ? {
            aiTokensUsed: usageRecord.aiTokensUsed.toString(),
            aiCostCents: usageRecord.aiCostCents,
            scrapesExecuted: usageRecord.scrapesExecuted,
            leadsProcessed: usageRecord.leadsProcessed,
            apiCallsMade: usageRecord.apiCallsMade,
          }
        : null,
    };
  }

  async exists(id: string): Promise<boolean> {
    const count = await this.organizationRepository.count({ where: { id } });
    return count > 0;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private toOrganizationDto(org: {
    id: string;
    name: string;
    slug: string;
    tier: string;
    maxLeadsPerDay: number;
    maxAiTokensPerMonth: bigint;
    serviceOffering: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): OrganizationResponseDto {
    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      tier: org.tier,
      maxLeadsPerDay: org.maxLeadsPerDay,
      maxAiTokensPerMonth: org.maxAiTokensPerMonth.toString(),
      serviceOffering: org.serviceOffering,
      createdAt: org.createdAt,
      updatedAt: org.updatedAt,
    };
  }
}
