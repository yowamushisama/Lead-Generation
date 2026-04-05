import { LeadTier } from '../common/enums/lead-tier.enum';

export const SCORING_THRESHOLDS = {
  HOT: 20,    // Score >= 20 → HOT (human approval required)
  WARM: 10,   // Score 10–19 → WARM (auto-queue with review window)
  COLD: 0,    // Score < 10 → COLD (deprioritized)
} as const;

export function getTier(score: number): LeadTier {
  if (score >= SCORING_THRESHOLDS.HOT) return LeadTier.HOT;
  if (score >= SCORING_THRESHOLDS.WARM) return LeadTier.WARM;
  return LeadTier.COLD;
}
