export interface ScoringFactor {
  name: string;
  weight: number;
  score: number;
  reasoning: string;
  maxPossible: number;
}

export interface ScoringBreakdown {
  factors: ScoringFactor[];
  totalScore: number;
  normalizedScore: number;
  tier: string;
  computedAt: string;
}
