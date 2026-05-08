import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { LeadRepository } from '../database/repositories/lead.repository';
import { DeduplicationService } from './deduplication.service';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { LeadFilterDto } from './dto/lead-filter.dto';
import { PaginationDto, PaginatedResult, paginate } from '../common/dto/pagination.dto';
import { LeadStatus } from '../common/enums/lead-status.enum';
import { getTierFromScore } from '../common/enums/lead-tier.enum';
import { Lead, Prisma } from '@prisma/client';
import { LeadDetailResponseDto } from './dto/lead-response.dto';

export interface LeadStats {
  total: number;
  averageScore: number;
  byTier: Record<string, number>;
  byStatus: Record<string, number>;
  bySource: Record<string, number>;
}

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    private readonly leadRepository: LeadRepository,
    private readonly deduplicationService: DeduplicationService,
  ) {}

  async create(tenant: TenantContext, dto: CreateLeadDto): Promise<Lead> {
    const { organizationId } = tenant;

    // Deduplication check
    const isDuplicate = await this.deduplicationService.checkDuplicate({
      name: dto.name,
      email: dto.email,
      company: dto.company,
      phone: dto.phone,
      address: dto.location,
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
      phone: dto.phone,
      address: dto.location,
      source: dto.source,
      organizationId,
    });

    const dataExpiresAt = new Date();
    dataExpiresAt.setDate(
      dataExpiresAt.getDate() + parseInt(process.env['DATA_RETENTION_DAYS'] ?? '90', 10),
    );

    const lead = await this.leadRepository.create({
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
  ): Promise<PaginatedResult<Lead>> {
    const { organizationId } = tenant;

    const where: Prisma.LeadWhereInput = {
      organizationId,
      ...(filter.status && { status: filter.status }),
      ...(filter.tier && { tier: filter.tier }),
      ...(filter.source && { source: filter.source }),
      ...(filter.campaignId && { campaignId: filter.campaignId }),
      ...(filter.minScore !== undefined && { score: { gte: filter.minScore } }),
      ...(filter.maxScore !== undefined && {
        score: {
          ...(filter.minScore !== undefined ? { gte: filter.minScore } : {}),
          lte: filter.maxScore,
        },
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
      this.leadRepository.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: {
          [pagination.sortBy ?? 'createdAt']: pagination.sortOrder ?? 'desc',
        },
      }),
      this.leadRepository.count({ where }),
    ]);

    return paginate(leads, total, pagination);
  }

  async findOne(organizationId: string, id: string): Promise<LeadDetailResponseDto> {
    const lead = await this.leadRepository.findFirst({
      where: { id, organizationId, optedOut: false },
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

    return {
      id: lead.id,
      organizationId: lead.organizationId,
      externalId: lead.externalId,
      source: lead.source,
      sourceUrl: lead.sourceUrl,
      sourceType: lead.sourceType,
      name: lead.name,
      headline: lead.headline,
      bio: lead.bio,
      role: lead.role,
      company: lead.company,
      companySize: lead.companySize,
      industry: lead.industry,
      location: lead.location,
      email: lead.email,
      phone: lead.phone,
      website: lead.website,
      intentType: lead.intentType,
      intentUrgency: lead.intentUrgency,
      intentConfidence: lead.intentConfidence,
      isBuyer: lead.isBuyer,
      budgetSignal: lead.budgetSignal,
      hiringIntent: lead.hiringIntent,
      companyStage: lead.companyStage,
      technicalLevel: lead.technicalLevel,
      score: lead.score,
      tier: lead.tier,
      recommendedChannel: lead.recommendedChannel,
      status: lead.status,
      optedOut: lead.optedOut,
      optedOutAt: lead.optedOutAt,
      dataExpiresAt: lead.dataExpiresAt,
      campaignId: lead.campaignId,
      placeId: (lead as any).placeId ?? null,
      rating: (lead as any).rating ?? null,
      reviewCount: (lead as any).reviewCount ?? null,
      businessType: (lead as any).businessType ?? null,
      businessHours: (lead as any).businessHours ?? null,
      lastReviewAt: (lead as any).lastReviewAt ?? null,
      googleTypes: (lead as any).googleTypes ?? null,
      socialHandles: (lead as any).socialHandles ?? null,
      websiteAudit: (lead as any).websiteAudit ?? null,
      enrichmentStatus: (lead as any).enrichmentStatus ?? null,
      scoreBreakdown: (lead as any).scoreBreakdown ?? null,
      painPoints: (lead as any).painPoints ?? null,
      fears: (lead as any).fears ?? null,
      desires: (lead as any).desires ?? null,
      intentReasoning: (lead as any).intentReasoning ?? null,
      toneProfile: (lead as any).toneProfile ?? null,
      messages: lead.messages.map((m: any) => ({
        id: m.id,
        channel: m.channel,
        subject: m.subject,
        body: m.body,
        status: m.status,
        sentAt: m.sentAt,
        createdAt: m.createdAt,
      })),
      conversations: lead.conversations.map((c: any) => ({
        id: c.id,
        channel: c.channel,
        messageCount: c.messageCount,
        lastMessageAt: c.lastMessageAt,
        status: c.status,
      })),
      createdAt: lead.createdAt,
      updatedAt: lead.updatedAt,
    };
  }

  async update(organizationId: string, id: string, dto: UpdateLeadDto): Promise<Lead> {
    const existing = await this.leadRepository.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      throw new NotFoundException(`Lead with ID '${id}' not found`);
    }

    if (dto.optedOut && !existing.optedOut) {
      return this.optOut(organizationId, id);
    }

    const tier = dto.score !== undefined ? getTierFromScore(dto.score) : undefined;

    const updated = await this.leadRepository.update({
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
    const existing = await this.leadRepository.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      throw new NotFoundException(`Lead with ID '${id}' not found`);
    }

    await this.leadRepository.delete({ where: { id } });

    this.logger.log({
      message: 'Lead deleted',
      module: 'LeadsService',
      organizationId,
      leadId: id,
    });
  }

  async optOut(organizationId: string, id: string): Promise<Lead> {
    const existing = await this.leadRepository.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      throw new NotFoundException(`Lead with ID '${id}' not found`);
    }

    const updated = await this.leadRepository.update({
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

  async getStats(organizationId: string): Promise<LeadStats> {
    const [total, byTier, byStatus, bySource, avgScore] = await Promise.all([
      this.leadRepository.count({ where: { organizationId } }),
      this.leadRepository.countByTier({ organizationId }),
      this.leadRepository.countByStatus({ organizationId }),
      this.leadRepository.countBySource({ organizationId }),
      this.leadRepository.aggregate({
        where: { organizationId },
        _avg: { score: true },
      }),
    ]);

    return {
      total,
      averageScore: avgScore._avg?.score ?? 0,
      byTier: Object.fromEntries(byTier.map((r) => [r.tier, r._count.id])),
      byStatus: Object.fromEntries(byStatus.map((r) => [r.status, r._count.id])),
      bySource: Object.fromEntries(bySource.map((r) => [r.source, r._count.id])),
    };
  }
}
