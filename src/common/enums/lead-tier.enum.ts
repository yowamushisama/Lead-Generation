export enum LeadTier {
  HOT = 'HOT',
  WARM = 'WARM',
  COLD = 'COLD',
}

export const TIER_THRESHOLDS = {
  HOT: 20,
  WARM: 10,
} as const;

export function getTierFromScore(score: number): LeadTier {
  if (score >= TIER_THRESHOLDS.HOT) return LeadTier.HOT;
  if (score >= TIER_THRESHOLDS.WARM) return LeadTier.WARM;
  return LeadTier.COLD;
}
