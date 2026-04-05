import { TenantMode } from '../../common/enums/tenant-mode.enum';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES, JOB_NAMES } from '../../common/constants/queue-names';
import { PipelineJobData } from '../orchestrator.service';
import { IntentDetectorStage } from '../stages/intent-detector.stage';
import { PrismaService } from '../../database/prisma.service';
import { LeadStatus } from '../../common/enums/lead-status.enum';
import { OrchestratorService } from '../orchestrator.service';

@Processor(QUEUE_NAMES.INTENT)
export class IntentProcessor extends WorkerHost {
  private readonly logger = new Logger(IntentProcessor.name);

  constructor(
    private readonly intentStage: IntentDetectorStage,
    private readonly prisma: PrismaService,
    private readonly orchestrator: OrchestratorService,
  ) {
    super();
  }

  async process(job: Job<PipelineJobData>): Promise<void> {
    const { leadId, rawInput, organizationId, userId, campaignId } = job.data;
    const context = { organizationId, userId, mode: TenantMode.SINGLE };

    this.logger.log({ message: `Processing intent job`, jobId: job.id, leadId });

    try {
      // If no leadId yet, we need to create the lead first
      let resolvedLeadId = leadId;
      if (!resolvedLeadId && rawInput) {
        const lead = await this.prisma.lead.create({
          data: {
            organizationId,
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
            originalContent: rawInput.originalContent,
            campaignId,
            status: LeadStatus.NEW,
            tier: 'COLD',
            score: 0,
            dataExpiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          },
        });
        resolvedLeadId = lead.id;
      }

      const content = rawInput?.originalContent ?? '';
      const platform = rawInput?.source ?? 'unknown';

      const output = await this.intentStage.process(
        { leadId: resolvedLeadId, originalContent: content, platform },
        context,
      );

      // Persist intent results
      await this.prisma.lead.update({
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

      // Enqueue next stage if confidence meets threshold
      if (output.intent.intentConfidence >= 0.5) {
        await this.orchestrator.enqueueForStage(resolvedLeadId, 'enrich', context, { campaignId });
      } else {
        await this.prisma.lead.update({
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
}
