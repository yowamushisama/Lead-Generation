import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { LeadStatus } from '../common/enums/lead-status.enum';
import { DataRetentionService } from './data-retention.service';
import { LeadExportResponseDto, StoredMessageEntryDto } from './dto/compliance-response.dto';

/**
 * Cast a Prisma JSON field to a typed array.
 * Prisma's `JsonValue` cannot be directly assigned to typed interfaces;
 * `unknown` is the canonical TypeScript bridge for this constraint.
 */
function fromJsonArray<T>(json: import('@prisma/client').Prisma.JsonValue): T[] {
  return json as unknown as T[];
}

@Injectable()
export class ComplianceService {
  private readonly logger = new Logger(ComplianceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dataRetention: DataRetentionService,
  ) {}

  /**
   * GDPR: Right to opt out / be forgotten
   */
  async processOptOut(tenant: TenantContext, leadId: string): Promise<void> {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, organizationId: tenant.organizationId },
    });
    if (!lead) throw new NotFoundException(`Lead ${leadId} not found`);

    // Mark opted-out atomically — optedOut:true ensures immediate exclusion from
    // all active lead queries and outreach eligibility checks.
    await this.prisma.$transaction(async (tx) => {
      await tx.lead.update({
        where: { id: leadId },
        data: {
          optedOut: true,
          status: LeadStatus.OPT_OUT,
          optedOutAt: new Date(),
          dataExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      // Cancel all in-flight and queued messages for this lead
      await tx.message.updateMany({
        where: {
          leadId,
          organizationId: tenant.organizationId,
          status: { in: ['PENDING_APPROVAL', 'APPROVED', 'QUEUED', 'DRAFT'] },
        },
        data: { status: 'REJECTED' },
      });
    });

    this.logger.log({
      message: `Opt-out processed for lead ${leadId}`,
      organizationId: tenant.organizationId,
    });
  }

  /**
   * GDPR: Right of access — export all data for a lead
   */
  async exportLeadData(tenant: TenantContext, leadId: string): Promise<LeadExportResponseDto> {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, organizationId: tenant.organizationId },
      include: {
        messages: { select: { channel: true, body: true, status: true, generatedAt: true } },
        conversations: { select: { channel: true, messages: true, status: true } },
      },
    });

    if (!lead) throw new NotFoundException(`Lead ${leadId} not found`);

    return {
      exportedAt: new Date().toISOString(),
      lead: {
        id: lead.id,
        name: lead.name ?? '',
        email: lead.email,
        role: lead.role,
        company: lead.company,
        source: lead.source,
        createdAt: lead.createdAt,
        status: lead.status,
        score: lead.score,
        messages: lead.messages,
        conversations: lead.conversations.map((c) => ({
          channel: c.channel,
          messages: fromJsonArray<StoredMessageEntryDto>(c.messages),
          status: c.status,
        })),
      },
    };
  }

  /**
   * GDPR: Right to erasure (immediate)
   */
  async deleteLeadData(tenant: TenantContext, leadId: string): Promise<void> {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, organizationId: tenant.organizationId },
    });
    if (!lead) throw new NotFoundException(`Lead ${leadId} not found`);

    await this.prisma.lead.delete({ where: { id: leadId } });

    this.logger.log({
      message: `Lead data deleted (right to erasure): ${leadId}`,
      organizationId: tenant.organizationId,
    });
  }

  async getRetentionSummary(tenant: TenantContext) {
    const now = new Date();
    const [expiringSoon, optedOut, total] = await Promise.all([
      this.prisma.lead.count({
        where: {
          organizationId: tenant.organizationId,
          dataExpiresAt: { lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), gte: now },
        },
      }),
      this.prisma.lead.count({
        where: { organizationId: tenant.organizationId, status: LeadStatus.OPT_OUT },
      }),
      this.prisma.lead.count({ where: { organizationId: tenant.organizationId } }),
    ]);

    return {
      totalLeads: total,
      optedOut,
      expiringSoon,
      retentionPolicyDays: parseInt(process.env['DATA_RETENTION_DAYS'] ?? '90', 10),
    };
  }
}
