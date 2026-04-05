import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(private readonly prismaService: PrismaService) {}

  async create(dto: CreateOrganizationDto): Promise<unknown> {
    const existing = await this.prismaService.organization.findUnique({
      where: { slug: dto.slug },
    });

    if (existing) {
      throw new ConflictException(`Organization slug '${dto.slug}' is already taken`);
    }

    const organization = await this.prismaService.organization.create({
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

    return organization;
  }

  async findById(id: string): Promise<unknown> {
    const organization = await this.prismaService.organization.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            leads: true,
            campaigns: true,
          },
        },
      },
    });

    if (!organization) {
      throw new NotFoundException(`Organization with ID '${id}' not found`);
    }

    return organization;
  }

  async findBySlug(slug: string): Promise<unknown> {
    const organization = await this.prismaService.organization.findUnique({
      where: { slug },
    });

    if (!organization) {
      throw new NotFoundException(`Organization with slug '${slug}' not found`);
    }

    return organization;
  }

  async update(id: string, dto: UpdateOrganizationDto): Promise<unknown> {
    await this.findById(id);

    if (dto.slug) {
      const existing = await this.prismaService.organization.findFirst({
        where: { slug: dto.slug, NOT: { id } },
      });

      if (existing) {
        throw new ConflictException(`Organization slug '${dto.slug}' is already taken`);
      }
    }

    const updated = await this.prismaService.organization.update({
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

    return updated;
  }

  async getStats(organizationId: string): Promise<unknown> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [organization, leadsToday, totalLeads, hotLeads, usageRecord] = await Promise.all([
      this.prismaService.organization.findUnique({ where: { id: organizationId } }),
      this.prismaService.lead.count({
        where: { organizationId, createdAt: { gte: today } },
      }),
      this.prismaService.lead.count({ where: { organizationId } }),
      this.prismaService.lead.count({ where: { organizationId, tier: 'HOT' } }),
      this.prismaService.usageRecord.findFirst({
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
    const count = await this.prismaService.organization.count({ where: { id } });
    return count > 0;
  }
}
