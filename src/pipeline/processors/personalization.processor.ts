import { TenantMode } from '../../common/enums/tenant-mode.enum';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../../common/constants/queue-names';
import { PipelineJobData } from '../orchestrator.service';
import { PersonalizerStage } from '../stages/personalizer.stage';
import { LeadRepository } from '../../database/repositories/lead.repository';
import { OrganizationRepository } from '../../database/repositories/organization.repository';
import { LeadStatus } from '../../common/enums/lead-status.enum';
import { OrchestratorService } from '../orchestrator.service';

@Processor(QUEUE_NAMES.PERSONALIZE)
export class PersonalizationProcessor extends WorkerHost {
  private readonly logger = new Logger(PersonalizationProcessor.name);

  constructor(
    private readonly personalizerStage: PersonalizerStage,
    private readonly leadRepository: LeadRepository,
    private readonly organizationRepository: OrganizationRepository,
    private readonly orchestrator: OrchestratorService,
  ) {
    super();
  }

  async process(job: Job<PipelineJobData>): Promise<void> {
    const { leadId, organizationId, userId, campaignId } = job.data;
    const context = { organizationId, userId, mode: TenantMode.SINGLE };

    this.logger.log({ message: `Processing personalization job`, jobId: job.id, leadId });

    try {
      if (!leadId) throw new Error(`Personalization job ${job.id} is missing leadId`);
      const [lead, org] = await Promise.all([
        this.leadRepository.findUnique({ where: { id: leadId } }),
        this.organizationRepository.findUnique({ where: { id: organizationId } }),
      ]);

      if (!lead) throw new Error(`Lead ${leadId} not found`);

      const serviceOffering = org?.serviceOffering ?? 'software development services';
      const uniqueValue = org?.uniqueValue ?? 'fast delivery and quality code';

      const output = await this.personalizerStage.process(
        {
          leadId,
          name: lead.name,
          role: lead.role ?? undefined,
          company: lead.company ?? undefined,
          originalContent: lead.originalContent ?? '',
          painPoints: (lead.painPoints as string[]) ?? [],
          intentReasoning: lead.intentReasoning ?? '',
          serviceOffering,
          uniqueValue,
        },
        context,
      );

      await this.leadRepository.update({
        where: { id: leadId },
        data: {
          personalizationData: output.personalization as never,
          status: LeadStatus.PERSONALIZED,
        },
      });

      await this.orchestrator.enqueueForStage(leadId, 'outreach', context, { campaignId });
    } catch (error) {
      this.logger.error({
        message: `Personalization processor error`,
        jobId: job.id,
        error: String(error),
      });
      throw error;
    }
  }
}
