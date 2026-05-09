import { TenantMode } from '../../common/enums/tenant-mode.enum';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { Lead } from '@prisma/client';
import { QUEUE_NAMES } from '../../common/constants/queue-names';
import { PipelineJobData } from '../orchestrator.service';
import { IntentDetectorStage } from '../stages/intent-detector.stage';
import { LeadRepository } from '../../database/repositories/lead.repository';
import { LeadStatus } from '../../common/enums/lead-status.enum';
import { OrchestratorService } from '../orchestrator.service';
import { LeadIngestionService } from '../lead-ingestion.service';
import { RawLeadInput } from '../../common/interfaces/lead-input.interface';

@Processor(QUEUE_NAMES.INTENT)
export class IntentProcessor extends WorkerHost {
  private readonly logger = new Logger(IntentProcessor.name);

  constructor(
    private readonly intentStage: IntentDetectorStage,
    private readonly leadRepository: LeadRepository,
    private readonly orchestrator: OrchestratorService,
    private readonly leadIngestion: LeadIngestionService,
  ) {
    super();
  }

  async process(job: Job<PipelineJobData>): Promise<void> {
    const { leadId, rawInput, organizationId, userId, campaignId } = job.data;
    const context = { organizationId, userId, mode: TenantMode.SINGLE };

    this.logger.log({ message: `Processing intent job`, jobId: job.id, leadId });

    try {
      let resolvedLeadId = leadId;
      let processingInput = rawInput;

      if (!resolvedLeadId && rawInput) {
        const ingestion = await this.leadIngestion.ingestRawLead(rawInput, context, { campaignId });
        if (!ingestion.created) {
          this.logger.log({
            message: 'Duplicate skipped by intent processor ingestion fallback',
            jobId: job.id,
            leadId: ingestion.lead.id,
            externalId: rawInput.externalId,
            source: rawInput.source,
            organizationId,
          });
          return;
        }

        resolvedLeadId = ingestion.lead.id;
      }

      if (!resolvedLeadId) {
        throw new Error('Intent job requires either leadId or rawInput');
      }

      if (!processingInput) {
        const lead = await this.leadRepository.findFirst({
          where: { id: resolvedLeadId, organizationId },
        });
        if (!lead) {
          throw new Error(`Lead ${resolvedLeadId} not found for organization ${organizationId}`);
        }
        processingInput = this.toRawInput(lead);
      }

      // Discovery leads carry no post content for intent classification; skip
      // intent classification but still run enrichment before scoring.
      if (processingInput.sourceType === 'discovery') {
        await this.orchestrator.enqueueForStage(resolvedLeadId, 'enrich', context, { campaignId });
        return;
      }

      const content = processingInput.originalContent ?? '';
      const platform = processingInput.source ?? 'unknown';

      const output = await this.intentStage.process(
        { leadId: resolvedLeadId, originalContent: content, platform },
        context,
      );

      await this.leadRepository.update({
        where: { id: resolvedLeadId },
        data: {
          intentType: output.intent.intentType,
          intentConfidence: output.intent.intentConfidence,
          intentUrgency: output.intent.intentUrgency,
          intentReasoning: output.intent.intentReasoning,
          painPoints: output.intent.painPoints,
          status: LeadStatus.NEW,
        },
      });

      if (output.intent.intentConfidence >= 0.5) {
        await this.orchestrator.enqueueForStage(resolvedLeadId, 'enrich', context, { campaignId });
      } else {
        await this.leadRepository.update({
          where: { id: resolvedLeadId },
          data: { status: LeadStatus.DISQUALIFIED },
        });
        this.logger.log({ message: `Lead disqualified (low confidence)`, leadId: resolvedLeadId });
      }
    } catch (error) {
      this.logger.error({ message: `Intent processor error`, jobId: job.id, error: String(error) });
      throw error;
    }
  }

  private toRawInput(lead: Lead): RawLeadInput {
    return {
      externalId: lead.externalId ?? undefined,
      source: lead.source,
      sourceUrl: lead.sourceUrl ?? undefined,
      sourceType: lead.sourceType,
      name: lead.name,
      headline: lead.headline ?? undefined,
      bio: lead.bio ?? undefined,
      role: lead.role ?? undefined,
      company: lead.company ?? undefined,
      companySize: lead.companySize ?? undefined,
      industry: lead.industry ?? undefined,
      location: lead.location ?? undefined,
      email: lead.email ?? undefined,
      phone: lead.phone ?? undefined,
      website: lead.website ?? undefined,
      originalContent: lead.originalContent ?? undefined,
    };
  }
}
