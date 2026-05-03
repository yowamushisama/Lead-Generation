import { ScoringFactor } from '../../common/interfaces/scoring-factor.interface';
import { WebsiteAuditInput, DigitalGapInput, DeepSignalsInput } from './digital-gap-factor.types';
import {
  GENERIC_TITLES,
  SIX_MONTHS_MS,
  SERVICE_INDUSTRY_KEYWORDS,
  TWENTY_FOUR_SEVEN_INDUSTRY_KEYWORDS,
} from './digital-gap-factor.config';

export { WebsiteAuditInput, DigitalGapInput } from './digital-gap-factor.types';

const MAX_POSSIBLE = 50;

/**
 * Scores a Google Maps lead based on weaknesses in their digital presence.
 * Higher score = more opportunity (worse digital presence = better prospect).
 *
 * Layered:
 * - Base 30 pts (existing): website existence, audit basics, social, reviews
 * - +20 pts (deep signals): chatbot, calculator, booking widget, schema, CRM, etc.
 *
 * UNREACHABLE / TIMEOUT statuses stay neutral (Cloudflare false-positive guard).
 */
export function scoreDigitalGapFactor(input: DigitalGapInput): ScoringFactor {
  let score = 0;
  const signals: string[] = [];

  const status = input.enrichmentStatus ?? null;
  const audit = input.websiteAudit ?? null;
  const social = input.socialHandles ?? null;
  const isServiceIndustry = matchesAnyKeyword(input, SERVICE_INDUSTRY_KEYWORDS);
  const is247Industry = matchesAnyKeyword(input, TWENTY_FOUR_SEVEN_INDUSTRY_KEYWORDS);

  // ── Website existence ────────────────────────────────────────────────────────
  if (status === 'NO_WEBSITE') {
    score += 12;
    signals.push('no website (+12)');
  } else if (status === 'OK' && audit) {
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

    const hasSocial =
      social && (social.instagram || social.facebook || social.tiktok);
    if (!hasSocial) {
      score += 3;
      signals.push('no social presence detected (+3)');
    }

    // ── Deep signals (only when website is reachable) ──────────────────────────
    const deep: DeepSignalsInput = audit.deepSignals ?? {};

    if (deep.hasChatbot === false) {
      score += 5;
      signals.push('no chatbot (+5)');
    }

    if (deep.hasEstimateCalculator === false) {
      score += 4;
      signals.push('no estimate calculator (+4)');
    }

    if (deep.hasBookingWidget === false && isServiceIndustry) {
      score += 5;
      signals.push('no booking widget (+5)');
    }

    if (deep.hasSchemaMarkup === false) {
      score += 3;
      signals.push('no schema markup (+3)');
    }

    if (
      deep.hasReviewSchema === false &&
      typeof input.reviewCount === 'number' &&
      input.reviewCount > 50
    ) {
      score += 2;
      signals.push('reviews not exposed via schema (+2)');
    }

    if (typeof deep.formFieldCount === 'number' && deep.formFieldCount < 4) {
      score += 2;
      signals.push(`generic contact form (${deep.formFieldCount} fields) (+2)`);
    }

    if (deep.emergencyPositioning === 'none' && is247Industry) {
      score += 3;
      signals.push('no emergency/24-7 positioning (+3)');
    }

    if (Array.isArray(deep.detectedCrm) && deep.detectedCrm.length === 0) {
      score += 2;
      signals.push('no CRM detected (+2)');
    }

    if (
      Array.isArray(deep.detectedEmailMarketing) &&
      deep.detectedEmailMarketing.length === 0
    ) {
      score += 2;
      signals.push('no email marketing detected (+2)');
    }

    if (deep.hasMaintenancePlanCopy === false && isServiceIndustry) {
      score += 2;
      signals.push('no maintenance/membership plan (+2)');
    }
  }
  // UNREACHABLE / TIMEOUT → neutral

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
    score: Math.min(score, MAX_POSSIBLE),
    maxPossible: MAX_POSSIBLE,
    reasoning:
      signals.length > 0
        ? `Digital opportunity signals: ${signals.join(', ')}`
        : 'No digital gaps detected',
  };
}

function matchesAnyKeyword(input: DigitalGapInput, keywords: string[]): boolean {
  const haystack = [
    input.industry ?? '',
    ...(input.googleTypes ?? []),
  ]
    .join(' ')
    .toLowerCase();
  if (!haystack.trim()) return false;
  return keywords.some((kw) => haystack.includes(kw));
}
