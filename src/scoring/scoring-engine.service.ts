import { Injectable } from '@nestjs/common';
import { ScoringBreakdown } from '../common/interfaces/scoring-factor.interface';
import { ScoringResult } from '../common/types/scoring.types';
import { IntentResult } from '../common/types/intent.types';
import { ICPConfig } from '../common/types/icp.types';
import { getTierFromScore } from '../common/enums/lead-tier.enum';
import { scoreIntentFactor } from './factors/intent-factor';
import { scoreUrgencyFactor } from './factors/urgency-factor';
import { scoreRoleFactor } from './factors/role-factor';
import { scoreRecencyFactor } from './factors/recency-factor';
import { scoreBudgetFactor } from './factors/budget-factor';
import { scoreICPFitFactor } from './factors/icp-fit-factor';
import { scoreNegativeFactors } from './factors/negative-factors';

export interface ScoringInput {
  intent: IntentResult;
  role?: string;
  industry?: string;
  companyStage?: string;
  location?: string;
  originalContent?: string;
  postedAt?: Date | string;
  icpConfig?: ICPConfig;
}

@Injectable()
export class ScoringEngineService {
  compute(input: ScoringInput): ScoringResult {
    const factors = [
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

    const totalScore = factors.reduce((sum, f) => sum + f.score, 0);
    const maxPossible = factors.reduce((sum, f) => sum + f.maxPossible, 0);
    const normalizedScore = maxPossible > 0 ? (totalScore / maxPossible) * 100 : 0;
    const tier = getTierFromScore(totalScore);

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
  meetsConfidenceThreshold(intent: IntentResult, threshold = 0.8): boolean {
    return intent.intentConfidence >= threshold && intent.isBuyer;
  }
}
