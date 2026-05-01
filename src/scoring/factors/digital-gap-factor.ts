import { ScoringFactor } from '../../common/interfaces/scoring-factor.interface';
import { WebsiteAuditInput, DigitalGapInput } from './digital-gap-factor.types';
import { GENERIC_TITLES, SIX_MONTHS_MS } from './digital-gap-factor.config';

export { WebsiteAuditInput, DigitalGapInput } from './digital-gap-factor.types';

/**
 * Scores a Google Maps lead based on weaknesses in their digital presence.
 * Higher score = more opportunity (worse digital presence = better prospect for services).
 *
 * Max possible: 30 points.
 * UNREACHABLE and TIMEOUT statuses are treated as neutral (not positive signal)
 * to avoid false-positives from Cloudflare-protected sites.
 */
export function scoreDigitalGapFactor(input: DigitalGapInput): ScoringFactor {
  let score = 0;
  const maxPossible = 30;
  const signals: string[] = [];

  const status = input.enrichmentStatus ?? null;
  const audit = input.websiteAudit ?? null;
  const social = input.socialHandles ?? null;

  // ── Website existence ────────────────────────────────────────────────────────
  if (status === 'NO_WEBSITE') {
    score += 12;
    signals.push('no website (+12)');
  } else if (status === 'OK' && audit) {
    // Website exists — score its quality gaps

    if (!audit.title || GENERIC_TITLES.test(audit.title.trim())) {
      score += 5;
      signals.push('missing or generic title (+5)');
    }

    if (!audit.metaDescription) {
      score += 3;
      signals.push('missing meta description (+3)');
    }

    if (audit.ctaPresent === false) {
      score += 4;
      signals.push('no CTA on homepage (+4)');
    }

    if (typeof audit.loadMs === 'number' && audit.loadMs > 3000) {
      score += 3;
      signals.push(`slow load ${audit.loadMs}ms (+3)`);
    }

    // Social absence is only meaningful when the website was actually fetched
    const hasSocial =
      social && (social.instagram || social.facebook || social.tiktok);
    if (!hasSocial) {
      score += 3;
      signals.push('no social presence detected (+3)');
    }
  }
  // UNREACHABLE and TIMEOUT → add nothing (neutral, not an opportunity signal)

  // ── Review signals (independent of website status) ────────────────────────────
  if (typeof input.reviewCount === 'number' && input.reviewCount < 50) {
    score += 5;
    signals.push(`low review count ${input.reviewCount} (+5)`);
  }

  if (
    typeof input.rating === 'number' &&
    input.rating >= 3.5 &&
    input.rating < 4.2
  ) {
    score += 3;
    signals.push(`mediocre rating ${input.rating} (+3)`);
  }

  if (input.lastReviewAt) {
    const lastReview =
      input.lastReviewAt instanceof Date
        ? input.lastReviewAt
        : new Date(input.lastReviewAt);
    const age = Date.now() - lastReview.getTime();
    if (!isNaN(age) && age > SIX_MONTHS_MS) {
      score += 5;
      signals.push(`last review >6 months ago (+5)`);
    }
  }

  return {
    name: 'digital-gap',
    weight: 1,
    score: Math.min(score, maxPossible),
    maxPossible,
    reasoning:
      signals.length > 0
        ? `Digital opportunity signals: ${signals.join(', ')}`
        : 'No digital gaps detected',
  };
}
