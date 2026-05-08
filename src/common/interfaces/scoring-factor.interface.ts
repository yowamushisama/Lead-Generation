export interface ScoringSignal {
  label: string;
  weight: number;
  category: string; // 'seo' | 'ux' | 'tech' | 'reviews' | 'positioning'
}

export interface ScoringFactor {
  name: string;
  weight: number;
  score: number;
  reasoning: string;
  maxPossible: number;
  signals?: ScoringSignal[];
}

export interface ScoringBreakdown {
  factors: ScoringFactor[];
  totalScore: number;
  normalizedScore: number;
  tier: string;
  computedAt: string;
}
