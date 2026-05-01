import { TenantMode } from '../../common/enums/tenant-mode.enum';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES, JOB_NAMES } from '../../common/constants/queue-names';
import { PipelineJobData } from '../orchestrator.service';
import { ICPEnricherStage } from '../stages/icp-enricher.stage';
import { WebsiteEnricherStage } from '../stages/website-enricher.stage';
import { LeadRepository } from '../../database/repositories/lead.repository';
import { OrganizationRepository } from '../../database/repositories/organization.repository';
import { LeadStatus } from '../../common/enums/lead-status.enum';
import { OrchestratorService } from '../orchestrator.service';
import { LeadSource } from '../../common/enums/lead-source.enum';

@Processor(QUEUE_NAMES.ENRICH)
export class EnrichmentProcessor extends WorkerHost {
  private readonly logger = new Logger(EnrichmentProcessor.name);

  constructor(
    private readonly enricherStage: ICPEnricherStage,
    private readonly websiteEnricher: WebsiteEnricherStage,
    private readonly leadRepository: LeadRepository,
    private readonly organizationRepository: OrganizationRepository,
    private readonly orchestrator: OrchestratorService,
  ) {
    super();
  }

  async process(job: Job<PipelineJobData>): Promise<void> {
    const { leadId, organizationId, userId, campaignId } = job.data;
    const context = { organizationId, userId, mode: TenantMode.SINGLE };

    this.logger.log({ message: `Processing enrichment job`, jobId: job.id, leadId });

    try {
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

      // Website + social enrichment for Google Maps leads
      if (lead.source === LeadSource.GOOGLE_MAPS) {
        const websiteResult = await this.websiteEnricher.process(lead.website ?? '');
        updateData.enrichmentStatus = websiteResult.enrichmentStatus;

        if (websiteResult.websiteAudit) {
          updateData.websiteAudit = websiteResult.websiteAudit as never;
        }

        if (Object.keys(websiteResult.socialHandles).length > 0) {
          // Merge with any social handles already scraped from the GMaps profile
          const existingSocial = (lead as any).socialHandles ?? {};
          updateData.socialHandles = { ...existingSocial, ...websiteResult.socialHandles } as never;
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
}
