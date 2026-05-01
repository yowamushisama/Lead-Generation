import { Injectable } from '@nestjs/common';
import { ScoringBreakdown } from '../common/interfaces/scoring-factor.interface';
import { ScoringResult } from '../common/types/scoring.types';
import { IntentResult } from '../common/types/intent.types';
import { ICPConfig } from '../common/types/icp.types';
import { LeadTier, getTierFromScore } from '../common/enums/lead-tier.enum';
import { getDiscoveryTier, getOpportunityTier } from './thresholds';
import { scoreIntentFactor } from './factors/intent-factor';
import { scoreUrgencyFactor } from './factors/urgency-factor';
import { scoreRoleFactor } from './factors/role-factor';
import { scoreRecencyFactor } from './factors/recency-factor';
import { scoreBudgetFactor } from './factors/budget-factor';
import { scoreICPFitFactor } from './factors/icp-fit-factor';
import { scoreNegativeFactors } from './factors/negative-factors';
import { scoreDiscoveryFactor, DiscoveryMetadata } from './factors/discovery-score-factor';
import { scoreDigitalGapFactor, DigitalGapInput } from './factors/digital-gap-factor';
import { scoreNicheFitFactor } from './factors/niche-fit-factor';

export interface ScoringInput {
  intent: IntentResult;
  role?: string;
  industry?: string;
  companyStage?: string;
  location?: string;
  originalContent?: string;
  postedAt?: Date | string;
  icpConfig?: ICPConfig;
  discoveryMetadata?: DiscoveryMetadata;
  /** Opportunity-track inputs (Google Maps leads) */
  digitalGap?: DigitalGapInput;
  googleTypes?: string[];
  targetIndustries?: string[];
}

export type ScoringTrack = 'intent' | 'discovery' | 'opportunity';

@Injectable()
export class ScoringEngineService {
  /**
   * Compute a lead score.
   *
   * @param track 'intent'      — LinkedIn: intent + urgency + role + recency + budget + ICP + negative
   *              'discovery'   — CSV/GMaps quality buyer: ICP fit + discovery quality + role + negative
   *              'opportunity' — GMaps underserved: digital-gap + niche-fit + role + negative + discovery(0.3)
   */
  compute(input: ScoringInput, track: ScoringTrack = 'intent'): ScoringResult {
    let factors: ReturnType<typeof scoreIntentFactor>[];
    let tier: LeadTier;

    if (track === 'opportunity') {
      factors = this.buildOpportunityFactors(input);
      const totalRaw = factors.reduce((sum, f) => sum + f.score, 0);
      tier = getOpportunityTier(totalRaw);
    } else if (track === 'discovery') {
      factors = this.buildDiscoveryFactors(input);
      const totalRaw = factors.reduce((sum, f) => sum + f.score, 0);
      tier = getDiscoveryTier(totalRaw);
    } else {
      factors = this.buildIntentFactors(input);
      const totalRaw = factors.reduce((sum, f) => sum + f.score, 0);
      tier = getTierFromScore(totalRaw);
    }

    const totalScore = factors.reduce((sum, f) => sum + f.score, 0);
    const maxPossible = factors.reduce((sum, f) => sum + f.maxPossible, 0);
    const normalizedScore = maxPossible > 0 ? (totalScore / maxPossible) * 100 : 0;

    const breakdown: ScoringBreakdown = {
      factors,
      totalScore,
      normalizedScore: Math.round(normalizedScore * 10) / 10,
      tier,
      computedAt: new Date().toISOString(),
    };

    return { score: totalScore, tier, breakdown };
  }

  meetsConfidenceThreshold(intent: IntentResult, threshold = 0.8): boolean {
    return intent.intentConfidence >= threshold && intent.isBuyer;
  }

  private buildIntentFactors(input: ScoringInput) {
    return [
      scoreIntentFactor(input.intent),
      scoreUrgencyFactor(input.intent.intentUrgency),
      scoreRoleFactor(input.role),
      scoreRecencyFactor(input.postedAt),
      scoreBudgetFactor(input.originalContent, input.intent.budgetSignal),
      ...(input.icpConfig
        ? [
            scoreICPFitFactor(
              { role: input.role, industry: input.industry, companyStage: input.companyStage, location: input.location },
              input.icpConfig,
            ),
          ]
        : []),
      scoreNegativeFactors(input.originalContent),
    ];
  }

  private buildDiscoveryFactors(input: ScoringInput) {
    return [
      scoreDiscoveryFactor(input.discoveryMetadata ?? {}),
      scoreRoleFactor(input.role),
      ...(input.icpConfig
        ? [
            scoreICPFitFactor(
              { role: input.role, industry: input.industry, companyStage: input.companyStage, location: input.location },
              input.icpConfig,
            ),
          ]
        : []),
      scoreNegativeFactors(input.originalContent),
    ];
  }

  private buildOpportunityFactors(input: ScoringInput) {
    // Reduced-weight discovery factor (quality contributes but doesn't dominate)
    const discoveryRaw = scoreDiscoveryFactor(input.discoveryMetadata ?? {});
    const discoveryWeighted = {
      ...discoveryRaw,
      score: Math.round(discoveryRaw.score * 0.3),
      maxPossible: Math.round(discoveryRaw.maxPossible * 0.3),
      name: 'discovery(weighted)',
    };

    return [
      scoreDigitalGapFactor(input.digitalGap ?? {}),
      scoreNicheFitFactor(input.googleTypes ?? [], input.targetIndustries ?? []),
      scoreRoleFactor(input.role),
      discoveryWeighted,
      scoreNegativeFactors(input.originalContent),
    ];
  }
}
