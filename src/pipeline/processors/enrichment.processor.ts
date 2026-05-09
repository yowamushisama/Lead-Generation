import { TenantMode } from '../../common/enums/tenant-mode.enum';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../../common/constants/queue-names';
import { PipelineJobData } from '../orchestrator.service';
import { ICPEnricherStage } from '../stages/icp-enricher.stage';
import { WebsiteEnricherStage } from '../stages/website-enricher.stage';
import { DeepReportGeneratorStage } from '../stages/deep-report-generator.stage';
import { LeadRepository } from '../../database/repositories/lead.repository';
import { OrganizationRepository } from '../../database/repositories/organization.repository';
import { CampaignRepository } from '../../database/repositories/campaign.repository';
import { LeadStatus } from '../../common/enums/lead-status.enum';
import { OrchestratorService } from '../orchestrator.service';
import { LeadSource } from '../../common/enums/lead-source.enum';
import { AppConfigService } from '../../config/config.service';
import { DeepSignals, WebsiteAudit } from '../stages/website-enricher.types';

@Processor(QUEUE_NAMES.ENRICH)
export class EnrichmentProcessor extends WorkerHost {
  private readonly logger = new Logger(EnrichmentProcessor.name);

  constructor(
    private readonly enricherStage: ICPEnricherStage,
    private readonly websiteEnricher: WebsiteEnricherStage,
    private readonly deepReportStage: DeepReportGeneratorStage,
    private readonly leadRepository: LeadRepository,
    private readonly organizationRepository: OrganizationRepository,
    private readonly campaignRepository: CampaignRepository,
    private readonly orchestrator: OrchestratorService,
    private readonly config: AppConfigService,
  ) {
    super();
  }

  async process(job: Job<PipelineJobData>): Promise<void> {
    const { leadId, organizationId, userId, campaignId } = job.data;
    const context = { organizationId, userId, mode: TenantMode.SINGLE };

    this.logger.log({ message: `Processing enrichment job`, jobId: job.id, leadId });

    try {
      if (!leadId) throw new Error(`Enrichment job ${job.id} is missing leadId`);
      const lead = await this.leadRepository.findUnique({ where: { id: leadId } });
      if (!lead) throw new Error(`Lead ${leadId} not found`);

      const org = await this.organizationRepository.findUnique({ where: { id: organizationId } });
      const serviceOffering = org?.serviceOffering ?? 'software development services';

      const profileContent = [
        lead.bio,
        lead.headline,
        lead.originalContent,
        lead.role,
        lead.company,
      ]
        .filter(Boolean)
        .join('\n');

      const output = await this.enricherStage.process(
        { leadId, profileContent, serviceOffering },
        context,
      );

      const updateData: Record<string, unknown> = {
        role: output.attributes.role !== 'Unknown' ? output.attributes.role : lead.role,
        industry:
          output.attributes.industry !== 'Unknown' ? output.attributes.industry : lead.industry,
        icpAttributes: output.attributes as never,
        status: LeadStatus.ENRICHED,
      };

      let websiteAudit: WebsiteAudit | null = null;
      let enrichmentStatus: string | null = null;

      // Website + social enrichment for Google Maps leads
      if (lead.source === LeadSource.GOOGLE_MAPS) {
        const websiteResult = await this.websiteEnricher.process(lead.website ?? '');
        enrichmentStatus = websiteResult.enrichmentStatus;
        updateData.enrichmentStatus = websiteResult.enrichmentStatus;

        if (websiteResult.websiteAudit) {
          websiteAudit = websiteResult.websiteAudit;
          updateData.websiteAudit = websiteResult.websiteAudit as never;
        }

        if (Object.keys(websiteResult.socialHandles).length > 0) {
          const existingSocial = (lead as Record<string, unknown>).socialHandles ?? {};
          updateData.socialHandles = {
            ...(existingSocial as Record<string, unknown>),
            ...websiteResult.socialHandles,
          } as never;
        }

        this.logger.log({
          message: `Website enrichment: ${websiteResult.enrichmentStatus}`,
          leadId,
          organizationId,
          url: lead.website ?? '(none)',
        });
      }

      await this.leadRepository.update({
        where: { id: leadId },
        data: updateData as never,
      });

      // ── Deep website report (env-gated, runs before scoring) ─────────────────
      if (this.shouldGenerateDeepReport(lead.source, enrichmentStatus, websiteAudit?.deepSignals)) {
        await this.runDeepReport({
          leadId,
          organizationId,
          campaignId,
          lead,
          websiteAudit: websiteAudit!,
          serviceOffering,
          context,
        });
      }

      await this.orchestrator.enqueueForStage(leadId, 'score', context, { campaignId });
    } catch (error) {
      this.logger.error({
        message: `Enrichment processor error`,
        jobId: job.id,
        error: String(error),
      });
      throw error;
    }
  }

  private shouldGenerateDeepReport(
    source: string,
    enrichmentStatus: string | null,
    deepSignals?: DeepSignals,
  ): boolean {
    if (!this.config.enableDeepReport) return false;
    if (source !== LeadSource.GOOGLE_MAPS) return false;
    if (enrichmentStatus !== 'OK') return false;
    if (!deepSignals) return false;
    if ((deepSignals.gapCount ?? 0) < 2) return false;
    return true;
  }

  private async runDeepReport(args: {
    leadId: string;
    organizationId: string;
    campaignId?: string;
    lead: Record<string, unknown>;
    websiteAudit: WebsiteAudit;
    serviceOffering: string;
    context: { organizationId: string; userId: string; mode: TenantMode };
  }): Promise<void> {
    try {
      const { lead, websiteAudit, campaignId } = args;
      const campaign = campaignId
        ? await this.campaignRepository.findUnique({ where: { id: campaignId } })
        : null;

      const targetIndustries = (campaign?.targetIndustries as string[] | null) ?? [];
      const googleTypes = (lead.googleTypes as string[] | null) ?? [];
      const businessHours = (lead.businessHours as Record<string, string> | null) ?? null;

      await this.deepReportStage.process(
        {
          leadId: args.leadId,
          organizationId: args.organizationId,
          campaignId: args.campaignId ?? null,
          promptInput: {
            leadName: (lead.name as string) ?? 'Unknown',
            company: (lead.company as string | null) ?? null,
            industry: (lead.industry as string | null) ?? null,
            location: (lead.location as string | null) ?? null,
            googleTypes,
            rating: (lead.rating as number | null) ?? null,
            reviewCount: (lead.reviewCount as number | null) ?? null,
            lastReviewAt: lead.lastReviewAt
              ? new Date(lead.lastReviewAt as string).toISOString().slice(0, 10)
              : null,
            businessHours,
            websiteUrl: (lead.website as string | null) ?? null,
            websiteAuditSummary: {
              title: websiteAudit.title,
              metaDescription: websiteAudit.metaDescription,
              loadMs: websiteAudit.loadMs,
              techStack: websiteAudit.techStack,
              ctaPresent: websiteAudit.ctaPresent,
            },
            deepSignals: websiteAudit.deepSignals!,
            campaignName: campaign?.name ?? null,
            targetIndustries,
            serviceOffering: args.serviceOffering,
            uniqueValue: null,
          },
        },
        args.context,
      );
    } catch (err) {
      // Non-fatal: a failed report must not block scoring
      this.logger.warn({
        message: 'Deep report generation threw — continuing pipeline',
        leadId: args.leadId,
        organizationId: args.organizationId,
        error: String(err),
      });
    }
  }
}
