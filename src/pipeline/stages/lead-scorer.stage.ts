import { Injectable, Logger } from '@nestjs/common';
import { IPipelineStage } from '../../common/interfaces/pipeline-stage.interface';
import { TenantContext } from '../../common/interfaces/tenant-context.interface';
import { ScoringEngineService, ScoringTrack } from '../../scoring/scoring-engine.service';
import { IntentResult } from '../../common/types/intent.types';
import { ScoringResult } from '../../common/types/scoring.types';
import { ICPConfig } from '../../common/types/icp.types';
import { DiscoveryMetadata } from '../../scoring/factors/discovery-score-factor';
import { DigitalGapInput } from '../../scoring/factors/digital-gap-factor';

export interface LeadScorerInput {
  leadId: string;
  intent: IntentResult;
  role?: string;
  industry?: string;
  companyStage?: string;
  location?: string;
  originalContent?: string;
  postedAt?: Date | string;
  icpConfig?: ICPConfig;
  scoringTrack?: ScoringTrack;
  discoveryMetadata?: DiscoveryMetadata;
  /** Opportunity-track inputs (Google Maps leads) */
  digitalGap?: DigitalGapInput;
  googleTypes?: string[];
  targetIndustries?: string[];
}

export interface LeadScorerOutput {
  leadId: string;
  scoring: ScoringResult;
  meetsThreshold: boolean;
}

@Injectable()
export class LeadScorerStage implements IPipelineStage<LeadScorerInput, LeadScorerOutput> {
  readonly stageName = 'lead-scorer';
  private readonly logger = new Logger(LeadScorerStage.name);

  constructor(private readonly scoringEngine: ScoringEngineService) {}

  async process(input: LeadScorerInput, context: TenantContext): Promise<LeadScorerOutput> {
    const track: ScoringTrack = input.scoringTrack ?? 'intent';

    const scoring = this.scoringEngine.compute(
      {
        intent: input.intent,
        role: input.role,
        industry: input.industry,
        companyStage: input.companyStage,
        location: input.location,
        originalContent: input.originalContent,
        postedAt: input.postedAt,
        icpConfig: input.icpConfig,
        discoveryMetadata: input.discoveryMetadata,
        digitalGap: input.digitalGap,
        googleTypes: input.googleTypes,
        targetIndustries: input.targetIndustries,
      },
      track,
    );

    // Discovery and opportunity leads bypass intent-confidence threshold
    const meetsThreshold =
      track === 'discovery' || track === 'opportunity'
        ? true
        : this.scoringEngine.meetsConfidenceThreshold(input.intent);

    this.logger.log({
      message: `Lead scored: ${scoring.score} (${scoring.tier}) [track: ${track}]`,
      leadId: input.leadId,
      organizationId: context.organizationId,
      score: scoring.score,
      tier: scoring.tier,
      meetsThreshold,
      track,
    });

    return { leadId: input.leadId, scoring, meetsThreshold };
  }
}
