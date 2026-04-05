import { ScoringFactor } from '../../common/interfaces/scoring-factor.interface';
import { IntentResult } from '../../common/types/intent.types';

export function scoreIntentFactor(intent: IntentResult): ScoringFactor {
  let score = 0;
  const maxPossible = 30;

  // Base score from confidence (0–20 points)
  score += intent.intentConfidence * 20;

  // Intent type bonus (0–10 points)
  const intentBonus: Record<string, number> = {
    BUYING: 10,
    HIRING: 8,
    PARTNERSHIP: 5,
    EXPLORING: 3,
    COMPARING: 2,
    RESEARCH: 1,
    COMPLAINING: 0,
    UNKNOWN: 0,
  };
  score += intentBonus[intent.intentType] ?? 0;

  return {
    name: 'intent',
    weight: 1,
    score: Math.min(score, maxPossible),
    maxPossible,
    reasoning: `Intent: ${intent.intentType} (confidence: ${(intent.intentConfidence * 100).toFixed(0)}%)`,
  };
}
