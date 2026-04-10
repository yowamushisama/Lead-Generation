import { LeadTier } from '../common/enums/lead-tier.enum';

export const SCORING_THRESHOLDS = {
  HOT: 20,    // Score >= 20 → HOT (human approval required)
  WARM: 10,   // Score 10–19 → WARM (auto-queue with review window)
  COLD: 0,    // Score < 10 → COLD (deprioritized)
} as const;

/**
 * Discovery-track thresholds.
 * Calibrated for ICP fit + quality signals (no intent factor present).
 * Slightly lower bar than intent track to surface viable prospects.
 */
export const DISCOVERY_THRESHOLDS = {
  HOT: 30,    // Score >= 30 → HOT  (strong ICP fit + excellent quality)
  WARM: 15,   // Score 15–29 → WARM (reasonable fit + social proof)
  COLD: 0,    // Score < 15  → COLD (poor fit or unproven quality)
} as const;

export function getTier(score: number): LeadTier {
  if (score >= SCORING_THRESHOLDS.HOT) return LeadTier.HOT;
  if (score >= SCORING_THRESHOLDS.WARM) return LeadTier.WARM;
  return LeadTier.COLD;
}

export function getDiscoveryTier(score: number): LeadTier {
  if (score >= DISCOVERY_THRESHOLDS.HOT) return LeadTier.HOT;
  if (score >= DISCOVERY_THRESHOLDS.WARM) return LeadTier.WARM;
  return LeadTier.COLD;
}
