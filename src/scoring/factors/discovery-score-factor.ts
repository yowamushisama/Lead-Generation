import { ScoringFactor } from '../../common/interfaces/scoring-factor.interface';

export interface DiscoveryMetadata {
  rating?: number;
  reviewCount?: number;
  businessType?: string;
}

/**
 * Scores a discovery lead (e.g. Google Maps) based on business quality signals.
 * Intent signals are absent for discovery leads, so this factor provides
 * an equivalent quality proxy using rating and social proof (review count).
 *
 * Max possible: 25 points (15 rating + 10 review count)
 */
export function scoreDiscoveryFactor(metadata: DiscoveryMetadata): ScoringFactor {
  let score = 0;
  const maxPossible = 25;
  const signals: string[] = [];

  // Rating score — max 15 pts
  if (metadata.rating !== undefined) {
    if (metadata.rating >= 4.5) {
      score += 15;
      signals.push(`rating ${metadata.rating} (excellent)`);
    } else if (metadata.rating >= 4.0) {
      score += 10;
      signals.push(`rating ${metadata.rating} (good)`);
    } else if (metadata.rating >= 3.5) {
      score += 5;
      signals.push(`rating ${metadata.rating} (average)`);
    } else {
      signals.push(`rating ${metadata.rating} (below average)`);
    }
  }

  // Review count score — max 10 pts (social proof)
  if (metadata.reviewCount !== undefined) {
    if (metadata.reviewCount >= 100) {
      score += 10;
      signals.push(`${metadata.reviewCount} reviews (high social proof)`);
    } else if (metadata.reviewCount >= 50) {
      score += 7;
      signals.push(`${metadata.reviewCount} reviews (moderate social proof)`);
    } else if (metadata.reviewCount >= 10) {
      score += 3;
      signals.push(`${metadata.reviewCount} reviews (low social proof)`);
    } else {
      signals.push(`${metadata.reviewCount ?? 0} reviews (minimal social proof)`);
    }
  }

  return {
    name: 'discovery',
    weight: 1,
    score: Math.min(score, maxPossible),
    maxPossible,
    reasoning:
      signals.length > 0
        ? `Discovery signals: ${signals.join(', ')}`
        : 'No discovery quality signals available',
  };
}
