import { LeadTier } from '../common/enums/lead-tier.enum';

export const SCORING_THRESHOLDS = {
  HOT: 20, // Score >= 20 → HOT (human approval required)
  WARM: 10, // Score 10–19 → WARM (auto-queue with review window)
  COLD: 0, // Score < 10 → COLD (deprioritized)
} as const;

export const DISCOVERY_THRESHOLDS = {
  HOT: 30, // Score >= 30 → HOT  (strong ICP fit + excellent quality)
  WARM: 15, // Score 15–29 → WARM (reasonable fit + social proof)
  COLD: 0, // Score < 15  → COLD (poor fit or unproven quality)
} as const;

/**
 * Opportunity-track thresholds (Google Maps underserved-business model).
 * HOT = strong gap signals (likely needs help); WARM = some gaps; COLD = well-established.
 */
export const OPPORTUNITY_THRESHOLDS = {
  HOT: 38, // Score >= 38 → HOT  (multiple digital gaps + niche match, deep-signals factored)
  WARM: 22, // Score 22–37 → WARM (some gaps, viable prospect)
  COLD: 0,  // Score < 22  → COLD (too established or off-niche)
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

export function getOpportunityTier(score: number): LeadTier {
  if (score >= OPPORTUNITY_THRESHOLDS.HOT) return LeadTier.HOT;
  if (score >= OPPORTUNITY_THRESHOLDS.WARM) return LeadTier.WARM;
  return LeadTier.COLD;
}
