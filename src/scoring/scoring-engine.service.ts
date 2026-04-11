import { Injectable } from '@nestjs/common';
import { ScoringBreakdown } from '../common/interfaces/scoring-factor.interface';
import { ScoringResult } from '../common/types/scoring.types';
import { IntentResult } from '../common/types/intent.types';
import { ICPConfig } from '../common/types/icp.types';
import { getTierFromScore } from '../common/enums/lead-tier.enum';
import { getDiscoveryTier } from './thresholds';
import { scoreIntentFactor } from './factors/intent-factor';
import { scoreUrgencyFactor } from './factors/urgency-factor';
import { scoreRoleFactor } from './factors/role-factor';
import { scoreRecencyFactor } from './factors/recency-factor';
import { scoreBudgetFactor } from './factors/budget-factor';
import { scoreICPFitFactor } from './factors/icp-fit-factor';
import { scoreNegativeFactors } from './factors/negative-factors';
import { scoreDiscoveryFactor, DiscoveryMetadata } from './factors/discovery-score-factor';

export interface ScoringInput {
  intent: IntentResult;
  role?: string;
  industry?: string;
  companyStage?: string;
  location?: string;
  originalContent?: string;
  postedAt?: Date | string;
  icpConfig?: ICPConfig;
  /** Optional discovery metadata (rating, reviewCount) for discovery-track leads */
  discoveryMetadata?: DiscoveryMetadata;
}

export type ScoringTrack = 'intent' | 'discovery';

@Injectable()
export class ScoringEngineService {
  /**
   * Compute a lead score.
   *
   * @param track 'intent'    — existing behaviour: intent + urgency + role + recency + budget + ICP + negative
   *              'discovery' — discovery-optimised: ICP fit + discovery quality + role + negative
   *                            (used for Google Maps / CSV leads with no intent signals)
   */
  compute(input: ScoringInput, track: ScoringTrack = 'intent'): ScoringResult {
    const factors =
      track === 'discovery' ? this.buildDiscoveryFactors(input) : this.buildIntentFactors(input);

    const totalScore = factors.reduce((sum, f) => sum + f.score, 0);
    const maxPossible = factors.reduce((sum, f) => sum + f.maxPossible, 0);
    const normalizedScore = maxPossible > 0 ? (totalScore / maxPossible) * 100 : 0;
    const tier =
      track === 'discovery' ? getDiscoveryTier(totalScore) : getTierFromScore(totalScore);

    const breakdown: ScoringBreakdown = {
      factors,
      totalScore,
      normalizedScore: Math.round(normalizedScore * 10) / 10,
      tier,
      computedAt: new Date().toISOString(),
    };

    return { score: totalScore, tier, breakdown };
  }

  // Confidence check — only proceed if intent confidence >= threshold
  // Discovery leads bypass this check (they have no intent confidence)
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
              {
                role: input.role,
                industry: input.industry,
                companyStage: input.companyStage,
                location: input.location,
              },
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
              {
                role: input.role,
                industry: input.industry,
                companyStage: input.companyStage,
                location: input.location,
              },
              input.icpConfig,
            ),
          ]
        : []),
      scoreNegativeFactors(input.originalContent),
    ];
  }
}
