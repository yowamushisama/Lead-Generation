import { TenantMode } from '../../common/enums/tenant-mode.enum';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../../common/constants/queue-names';
import { PipelineJobData } from '../orchestrator.service';
import { OutreachGeneratorStage } from '../stages/outreach-generator.stage';
import { LeadRepository } from '../../database/repositories/lead.repository';
import { MessageRepository } from '../../database/repositories/message.repository';
import { OrganizationRepository } from '../../database/repositories/organization.repository';
import { LeadStatus } from '../../common/enums/lead-status.enum';
import { PersonalizationResult } from '../../common/types/personalization.types';
import { MessageStatus } from '../../common/enums/message-status.enum';

@Processor(QUEUE_NAMES.OUTREACH)
export class OutreachProcessor extends WorkerHost {
  private readonly logger = new Logger(OutreachProcessor.name);

  constructor(
    private readonly outreachStage: OutreachGeneratorStage,
    private readonly leadRepository: LeadRepository,
    private readonly organizationRepository: OrganizationRepository,
    private readonly messageRepository: MessageRepository,
  ) {
    super();
  }

  async process(job: Job<PipelineJobData>): Promise<void> {
    const { leadId, organizationId, userId, campaignId } = job.data;
    const context = { organizationId, userId, mode: TenantMode.SINGLE };

    this.logger.log({ message: `Processing outreach job`, jobId: job.id, leadId });

    try {
      const [lead, org] = await Promise.all([
        this.leadRepository.findUnique({ where: { id: leadId } }),
        this.organizationRepository.findUnique({ where: { id: organizationId } }),
      ]);

      if (!lead) throw new Error(`Lead ${leadId} not found`);
      if (!lead.personalizationData) throw new Error(`Lead ${leadId} has no personalization data`);

      const personalization = lead.personalizationData as unknown as PersonalizationResult;
      const serviceOffering = org?.serviceOffering ?? 'software development services';

      const output = await this.outreachStage.process(
        {
          leadId,
          recipientName: lead.name,
          recipientRole: lead.role ?? undefined,
          personalization,
          serviceOffering,
        },
        context,
      );

      // Persist each generated message
      for (const msg of output.messages) {
        await this.messageRepository.create({
          data: {
            organizationId,
            leadId,
            campaignId,
            channel: msg.channel,
            subject: msg.subject,
            body: msg.body,
            spamScore: msg.spamScore,
            status: msg.isApproved ? MessageStatus.PENDING_APPROVAL : MessageStatus.REJECTED,
            generatedAt: new Date(),
          },
        });
      }

      await this.leadRepository.update({
        where: { id: leadId },
        data: { status: LeadStatus.MESSAGE_DRAFTED },
      });

      this.logger.log({
        message: `Outreach messages created for lead ${leadId}`,
        count: output.messages.length,
        approved: output.messages.filter((m) => m.isApproved).length,
        organizationId,
      });
    } catch (error) {
      this.logger.error({
        message: `Outreach processor error`,
        jobId: job.id,
        error: String(error),
      });
      throw error;
    }
  }
}
