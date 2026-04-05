import { ScoringFactor } from '../../common/interfaces/scoring-factor.interface';
import { UrgencyLevel } from '../../common/enums/urgency-level.enum';

export function scoreUrgencyFactor(urgency: UrgencyLevel): ScoringFactor {
  const urgencyScores: Record<UrgencyLevel, number> = {
    [UrgencyLevel.CRITICAL]: 15,
    [UrgencyLevel.HIGH]: 12,
    [UrgencyLevel.MEDIUM]: 8,
    [UrgencyLevel.LOW]: 4,
    [UrgencyLevel.NONE]: 0,
  };

  const score = urgencyScores[urgency] ?? 0;

  return {
    name: 'urgency',
    weight: 1,
    score,
    maxPossible: 15,
    reasoning: `Urgency level: ${urgency}`,
  };
}
