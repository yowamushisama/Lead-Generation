import { Injectable, Logger } from '@nestjs/common';
import { Lead, Prisma } from '@prisma/client';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { RawLeadInput } from '../common/interfaces/lead-input.interface';
import { LeadStatus } from '../common/enums/lead-status.enum';
import { LeadRepository } from '../database/repositories/lead.repository';
import { DeduplicationService } from '../leads/deduplication.service';
import { classifyWebsite } from '../adapters/google-maps/gmaps-filter';

export interface LeadIngestionResult {
  lead: Lead;
  created: boolean;
}

@Injectable()
export class LeadIngestionService {
  private readonly logger = new Logger(LeadIngestionService.name);

  constructor(
    private readonly leadRepository: LeadRepository,
    private readonly deduplicationService: DeduplicationService,
  ) {}

  async ingestRawLead(
    rawInput: RawLeadInput,
    tenant: TenantContext,
    options: { campaignId?: string } = {},
  ): Promise<LeadIngestionResult> {
    const organizationId = tenant.organizationId;
    const contentHash = this.deduplicationService.computeContentHash({
      name: rawInput.name ?? '',
      email: rawInput.email,
      company: rawInput.company,
      phone: rawInput.phone,
      address: rawInput.location,
      source: rawInput.source,
      organizationId,
    });

    const existing = await this.findExistingLead(rawInput, organizationId, contentHash);
    if (existing) {
      this.logger.log({
        message: 'Duplicate skipped at persist boundary',
        leadId: existing.id,
        externalId: rawInput.externalId,
        source: rawInput.source,
        organizationId,
      });
      return { lead: existing, created: false };
    }

    try {
      const meta = (rawInput.metadata ?? {}) as Record<string, unknown>;

      // Classify website meaningfulness centrally for all adapters.
      // Adapter may pass an explicit value (gmaps does); otherwise derive from website string.
      // null only when adapter provides neither website nor explicit classification.
      const hasMeaningfulWebsite: boolean | null =
        rawInput.hasMeaningfulWebsite !== undefined
          ? rawInput.hasMeaningfulWebsite
          : rawInput.website !== undefined
            ? (classifyWebsite(rawInput.website) ?? false)
            : null;

      const lead = await this.leadRepository.create({
        data: {
          organizationId,
          externalId: rawInput.externalId,
          source: rawInput.source,
          sourceUrl: rawInput.sourceUrl,
          sourceType: rawInput.sourceType ?? 'intent',
          name: rawInput.name,
          headline: rawInput.headline,
          bio: rawInput.bio,
          role: rawInput.role,
          company: rawInput.company,
          companySize: rawInput.companySize,
          industry: rawInput.industry,
          location: rawInput.location,
          email: rawInput.email,
          phone: rawInput.phone,
          website: rawInput.website,
          // hasMeaningfulWebsite requires schema migration + prisma:generate.
          // Cast to any until the generated client is refreshed post-migration.
          ...(hasMeaningfulWebsite !== null ? { hasMeaningfulWebsite } as any : {}),
          originalContent: rawInput.originalContent,
          contentHash,
          ...(rawInput.sourceType === 'discovery' && {
            placeId: meta['placeId'] as string | undefined,
            rating: meta['rating'] as number | undefined,
            reviewCount: meta['reviewCount'] as number | undefined,
            googleTypes: (meta['googleTypes'] as string[] | undefined) ?? undefined,
            businessHours: (meta['businessHours'] as object | undefined) ?? undefined,
            lastReviewAt: meta['lastReviewAt'] ? new Date(meta['lastReviewAt'] as string) : undefined,
            socialHandles: (meta['socialHandlesFromGmaps'] as object | undefined) ?? undefined,
          }),
          campaignId: options.campaignId,
          status: LeadStatus.NEW,
          tier: 'COLD',
          score: 0,
          dataExpiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        },
      });

      return { lead, created: true };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const lead = await this.findExistingLead(rawInput, organizationId, contentHash);
        if (lead) return { lead, created: false };
      }
      throw error;
    }
  }

  private async findExistingLead(
    rawInput: RawLeadInput,
    organizationId: string,
    contentHash: string,
  ): Promise<Lead | null> {
    if (rawInput.externalId) {
      const byExternalId = await this.leadRepository.findUnique({
        where: {
          externalId_source_organizationId: {
            externalId: rawInput.externalId,
            source: rawInput.source,
            organizationId,
          },
        },
      });
      if (byExternalId) return byExternalId;
    }

    if (rawInput.email) {
      const byEmail = await this.leadRepository.findFirst({
        where: {
          email: rawInput.email,
          organizationId,
          optedOut: false,
        },
      });
      if (byEmail) return byEmail;
    }

    return this.leadRepository.findFirst({
      where: {
        contentHash,
        organizationId,
      },
    });
  }
}
