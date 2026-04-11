import { LeadTier } from '../enums/lead-tier.enum';
import { ScoringBreakdown } from '../interfaces/scoring-factor.interface';

export interface ScoringWeights {
  intentConfidence: number;
  urgencyLevel: number;
  icpMatch: number;
  companyFit: number;
  engagementSignals: number;
  budgetSignals: number;
  hiringIntent: number;
  buyerRole: number;
}

export interface ScoringResult {
  score: number;
  tier: LeadTier;
  breakdown: ScoringBreakdown;
}

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  intentConfidence: 0.25,
  urgencyLevel: 0.2,
  icpMatch: 0.2,
  companyFit: 0.15,
  engagementSignals: 0.1,
  budgetSignals: 0.05,
  hiringIntent: 0.03,
  buyerRole: 0.02,
};
