import { TenantMode } from '../../common/enums/tenant-mode.enum';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from '../../common/constants/queue-names';
import { PipelineJobData } from '../orchestrator.service';
import { LeadScorerStage } from '../stages/lead-scorer.stage';
import { CampaignRepository } from '../../database/repositories/campaign.repository';
import { IcpProfileRepository } from '../../database/repositories/icp-profile.repository';
import { LeadRepository } from '../../database/repositories/lead.repository';
import { LeadStatus } from '../../common/enums/lead-status.enum';
import { LeadTier } from '../../common/enums/lead-tier.enum';
import { OrchestratorService } from '../orchestrator.service';
import { IntentResult } from '../../common/types/intent.types';
import { ICPConfig } from '../../common/types/icp.types';

@Processor(QUEUE_NAMES.SCORE)
export class ScoringProcessor extends WorkerHost {
  private readonly logger = new Logger(ScoringProcessor.name);

  constructor(
    private readonly scorerStage: LeadScorerStage,
    private readonly leadRepository: LeadRepository,
    private readonly campaignRepository: CampaignRepository,
    private readonly icpProfileRepository: IcpProfileRepository,
    private readonly orchestrator: OrchestratorService,
  ) {
    super();
  }

  async process(job: Job<PipelineJobData>): Promise<void> {
    const { leadId, organizationId, userId, campaignId } = job.data;
    const context = { organizationId, userId, mode: TenantMode.SINGLE };

    this.logger.log({ message: `Processing scoring job`, jobId: job.id, leadId });

    try {
      const lead = await this.leadRepository.findUnique({ where: { id: leadId } });
      if (!lead) throw new Error(`Lead ${leadId} not found`);

      // Reconstruct IntentResult from stored fields
      const intent: IntentResult = {
        intentType: (lead.intentType as never) ?? 'UNKNOWN',
        intentUrgency: (lead.intentUrgency as never) ?? 'NONE',
        intentConfidence: lead.intentConfidence ?? 0,
        isBuyer: (lead.intentConfidence ?? 0) >= 0.5,
        intentReasoning: lead.intentReasoning ?? '',
        painPoints: (lead.painPoints as string[]) ?? [],
        fears: [],
        desires: [],
        budgetSignal: undefined,
        hiringIntent: lead.intentType === 'HIRING',
        companyStage: (lead.icpAttributes as Record<string, string>)?.companyStage,
        technicalLevel: (lead.icpAttributes as Record<string, string>)?.technicalLevel,
      };

      // Load active ICP config if campaign has one
      let icpConfig: ICPConfig | undefined;
      if (campaignId) {
        const campaign = await this.campaignRepository.findUnique({ where: { id: campaignId } });
        if (campaign?.icpProfileId) {
          const icpProfile = await this.icpProfileRepository.findUnique({
            where: { id: campaign.icpProfileId },
          });
          icpConfig = icpProfile?.config as ICPConfig | undefined;
        }
      }

      const isDiscovery = lead.sourceType === 'discovery';

      const discoveryMetadata = isDiscovery
        ? {
            rating: lead.rating ?? undefined,
            reviewCount: lead.reviewCount ?? undefined,
          }
        : undefined;

      const output = await this.scorerStage.process(
        {
          leadId,
          intent,
          role: lead.role ?? undefined,
          industry: lead.industry ?? undefined,
          companyStage: (lead.icpAttributes as Record<string, string>)?.companyStage,
          location: lead.location ?? undefined,
          originalContent: lead.originalContent ?? undefined,
          icpConfig,
          scoringTrack: isDiscovery ? 'discovery' : 'intent',
          discoveryMetadata,
        },
        context,
      );

      await this.leadRepository.update({
        where: { id: leadId },
        data: {
          score: output.scoring.score,
          tier: output.scoring.tier,
          scoreBreakdown: output.scoring.breakdown as never,
          status: LeadStatus.SCORED,
        },
      });

      // Intent leads with low AI confidence are not worth personalizing — skip
      // them to avoid burning tokens on uncertain signals.
      if (!isDiscovery && (intent.intentConfidence ?? 0) < 0.5) {
        this.logger.log({
          message: `Lead ${leadId} below intent confidence threshold (${intent.intentConfidence ?? 0}) — not personalizing`,
          organizationId,
        });
        return;
      }

      // Only personalize HOT/WARM leads — use the already-computed tier so that
      // discovery leads are gated by DISCOVERY_THRESHOLDS, not the intent >= 10 cutoff.
      if (output.meetsThreshold && output.scoring.tier !== LeadTier.COLD) {
        await this.orchestrator.enqueueForStage(leadId, 'personalize', context, { campaignId });
      } else {
        this.logger.log({
          message: `Lead ${leadId} below threshold (score: ${output.scoring.score}) — not personalizing`,
          organizationId,
        });
      }
    } catch (error) {
      this.logger.error({
        message: `Scoring processor error`,
        jobId: job.id,
        error: String(error),
      });
      throw error;
    }
  }
}
