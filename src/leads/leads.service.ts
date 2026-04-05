import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { DeduplicationService } from './deduplication.service';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { LeadFilterDto } from './dto/lead-filter.dto';
import { PaginationDto, PaginatedResult, paginate } from '../common/dto/pagination.dto';
import { LeadStatus } from '../common/enums/lead-status.enum';
import { getTierFromScore } from '../common/enums/lead-tier.enum';
import { Prisma } from '@prisma/client';

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly deduplicationService: DeduplicationService,
  ) {}

  async create(tenant: TenantContext, dto: CreateLeadDto): Promise<unknown> {
    const { organizationId } = tenant;

    // Deduplication check
    const isDuplicate = await this.deduplicationService.checkDuplicate({
      name: dto.name,
      email: dto.email,
      company: dto.company,
      source: dto.source,
      organizationId,
      externalId: dto.externalId,
    });

    if (isDuplicate) {
      throw new ConflictException('A lead with similar details already exists');
    }

    const contentHash = this.deduplicationService.computeContentHash({
      name: dto.name,
      email: dto.email,
      company: dto.company,
      source: dto.source,
      organizationId,
    });

    const dataExpiresAt = new Date();
    dataExpiresAt.setDate(
      dataExpiresAt.getDate() + parseInt(process.env['DATA_RETENTION_DAYS'] ?? '90', 10),
    );

    const lead = await this.prismaService.lead.create({
      data: {
        organizationId,
        externalId: dto.externalId,
        source: dto.source,
        sourceUrl: dto.sourceUrl,
        sourceType: dto.sourceType ?? 'intent',
        name: dto.name,
        headline: dto.headline,
        bio: dto.bio,
        role: dto.role,
        company: dto.company,
        companySize: dto.companySize,
        industry: dto.industry,
        location: dto.location,
        email: dto.email,
        phone: dto.phone,
        website: dto.website,
        originalContent: dto.originalContent,
        campaignId: dto.campaignId,
        status: LeadStatus.NEW,
        tier: 'COLD',
        score: 0,
        contentHash,
        dataExpiresAt,
      },
    });

    this.logger.log({
      message: 'Lead created',
      module: 'LeadsService',
      organizationId,
      leadId: lead.id,
    });

    return lead;
  }

  async findAll(
    tenant: TenantContext,
    filter: LeadFilterDto,
    pagination: PaginationDto,
  ): Promise<PaginatedResult<unknown>> {
    const { organizationId } = tenant;

    const where: Prisma.LeadWhereInput = {
      organizationId,
      ...(filter.status && { status: filter.status }),
      ...(filter.tier && { tier: filter.tier }),
      ...(filter.source && { source: filter.source }),
      ...(filter.campaignId && { campaignId: filter.campaignId }),
      ...(filter.minScore !== undefined && { score: { gte: filter.minScore } }),
      ...(filter.maxScore !== undefined && {
        score: { ...(filter.minScore !== undefined ? { gte: filter.minScore } : {}), lte: filter.maxScore },
      }),
      ...(filter.industry && { industry: { contains: filter.industry, mode: 'insensitive' } }),
      ...(filter.location && { location: { contains: filter.location, mode: 'insensitive' } }),
      ...(filter.search && {
        OR: [
          { name: { contains: filter.search, mode: 'insensitive' } },
          { company: { contains: filter.search, mode: 'insensitive' } },
          { email: { contains: filter.search, mode: 'insensitive' } },
        ],
      }),
      optedOut: false,
    };

    const [leads, total] = await Promise.all([
      this.prismaService.lead.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: {
          [pagination.sortBy ?? 'createdAt']: pagination.sortOrder ?? 'desc',
        },
      }),
      this.prismaService.lead.count({ where }),
    ]);

    return paginate(leads, total, pagination);
  }

  async findOne(organizationId: string, id: string): Promise<unknown> {
    const lead = await this.prismaService.lead.findFirst({
      where: { id, organizationId },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
        conversations: {
          orderBy: { createdAt: 'desc' },
          take: 3,
        },
      },
    });

    if (!lead) {
      throw new NotFoundException(`Lead with ID '${id}' not found`);
    }

    return lead;
  }

  async update(organizationId: string, id: string, dto: UpdateLeadDto): Promise<unknown> {
    const existing = await this.prismaService.lead.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      throw new NotFoundException(`Lead with ID '${id}' not found`);
    }

    if (dto.optedOut && !existing.optedOut) {
      return this.optOut(organizationId, id);
    }

    const tier = dto.score !== undefined ? getTierFromScore(dto.score) : undefined;

    const updated = await this.prismaService.lead.update({
      where: { id },
      data: {
        ...(dto.status && { status: dto.status }),
        ...(dto.score !== undefined && { score: dto.score }),
        ...(tier && { tier }),
        ...(dto.name && { name: dto.name }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.company !== undefined && { company: dto.company }),
        ...(dto.role !== undefined && { role: dto.role }),
        ...(dto.industry !== undefined && { industry: dto.industry }),
        ...(dto.location !== undefined && { location: dto.location }),
        ...(dto.campaignId !== undefined && { campaignId: dto.campaignId }),
      },
    });

    this.logger.log({
      message: 'Lead updated',
      module: 'LeadsService',
      organizationId,
      leadId: id,
    });

    return updated;
  }

  async remove(organizationId: string, id: string): Promise<void> {
    const existing = await this.prismaService.lead.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      throw new NotFoundException(`Lead with ID '${id}' not found`);
    }

    await this.prismaService.lead.delete({ where: { id } });

    this.logger.log({
      message: 'Lead deleted',
      module: 'LeadsService',
      organizationId,
      leadId: id,
    });
  }

  async optOut(organizationId: string, id: string): Promise<unknown> {
    const existing = await this.prismaService.lead.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      throw new NotFoundException(`Lead with ID '${id}' not found`);
    }

    const updated = await this.prismaService.lead.update({
      where: { id },
      data: {
        optedOut: true,
        status: LeadStatus.OPT_OUT,
      },
    });

    this.logger.log({
      message: 'Lead opted out',
      module: 'LeadsService',
      organizationId,
      leadId: id,
    });

    return updated;
  }

  async bulkCreate(
    tenant: TenantContext,
    dtos: CreateLeadDto[],
  ): Promise<{ created: number; duplicates: number; errors: number }> {
    if (dtos.length > 500) {
      throw new BadRequestException('Bulk create is limited to 500 leads per request');
    }

    let created = 0;
    let duplicates = 0;
    let errors = 0;

    for (const dto of dtos) {
      try {
        await this.create(tenant, dto);
        created++;
      } catch (error) {
        if (error instanceof ConflictException) {
          duplicates++;
        } else {
          errors++;
          this.logger.error({
            message: 'Error in bulk create',
            module: 'LeadsService',
            organizationId: tenant.organizationId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    return { created, duplicates, errors };
  }

  async getStats(organizationId: string): Promise<unknown> {
    const [total, byTier, byStatus, bySource, avgScore] = await Promise.all([
      this.prismaService.lead.count({ where: { organizationId } }),
      this.prismaService.lead.groupBy({
        by: ['tier'],
        where: { organizationId },
        _count: { id: true },
      }),
      this.prismaService.lead.groupBy({
        by: ['status'],
        where: { organizationId },
        _count: { id: true },
      }),
      this.prismaService.lead.groupBy({
        by: ['source'],
        where: { organizationId },
        _count: { id: true },
      }),
      this.prismaService.lead.aggregate({
        where: { organizationId },
        _avg: { score: true },
      }),
    ]);

    return {
      total,
      averageScore: avgScore._avg.score ?? 0,
      byTier: Object.fromEntries(byTier.map((r) => [r.tier, r._count.id])),
      byStatus: Object.fromEntries(byStatus.map((r) => [r.status, r._count.id])),
      bySource: Object.fromEntries(bySource.map((r) => [r.source, r._count.id])),
    };
  }
}
