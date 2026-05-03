import { scoreDigitalGapFactor } from './digital-gap-factor';
import { DigitalGapInput, DeepSignalsInput } from './digital-gap-factor.types';

const baseDeep: DeepSignalsInput = {
  hasChatbot: true,
  hasEstimateCalculator: true,
  hasBookingWidget: true,
  hasSchemaMarkup: true,
  hasReviewSchema: true,
  hasFAQSchema: false,
  formFieldCount: 6,
  emergencyPositioning: 'prominent',
  detectedCrm: ['ServiceTitan'],
  detectedEmailMarketing: ['Mailchimp'],
  hasMaintenancePlanCopy: true,
  gapCount: 0,
};

function buildInput(overrides: Partial<DigitalGapInput> = {}): DigitalGapInput {
  return {
    enrichmentStatus: 'OK',
    websiteAudit: {
      title: 'Acme Plumbing — Columbus, OH',
      metaDescription: 'Family plumbing since 1970',
      ctaPresent: true,
      loadMs: 800,
      deepSignals: baseDeep,
    },
    socialHandles: { facebook: 'https://facebook.com/acme', instagram: 'https://instagram.com/acme' },
    rating: 4.8,
    reviewCount: 1200,
    industry: 'Plumbing',
    googleTypes: ['Plumber'],
    ...overrides,
  };
}

describe('scoreDigitalGapFactor (deep signals)', () => {
  it('rewards a fully-equipped service business with 0 points', () => {
    const result = scoreDigitalGapFactor(buildInput());
    expect(result.score).toBe(0);
    expect(result.maxPossible).toBe(50);
    expect(result.reasoning).toBe('No digital gaps detected');
  });

  it('adds +5 for missing chatbot', () => {
    const result = scoreDigitalGapFactor(
      buildInput({
        websiteAudit: {
          title: 'Acme',
          metaDescription: 'x',
          ctaPresent: true,
          loadMs: 800,
          deepSignals: { ...baseDeep, hasChatbot: false },
        },
      }),
    );
    expect(result.score).toBe(5);
    expect(result.reasoning).toContain('no chatbot');
  });

  it('adds +5 for missing booking widget — only in service industries', () => {
    const serviceIndustry = scoreDigitalGapFactor(
      buildInput({
        websiteAudit: {
          title: 'Acme',
          metaDescription: 'x',
          ctaPresent: true,
          loadMs: 800,
          deepSignals: { ...baseDeep, hasBookingWidget: false },
        },
      }),
    );
    expect(serviceIndustry.score).toBe(5);

    const nonServiceIndustry = scoreDigitalGapFactor(
      buildInput({
        industry: 'SaaS',
        googleTypes: ['Software company'],
        websiteAudit: {
          title: 'Acme',
          metaDescription: 'x',
          ctaPresent: true,
          loadMs: 800,
          deepSignals: { ...baseDeep, hasBookingWidget: false },
        },
      }),
    );
    expect(nonServiceIndustry.score).toBe(0);
  });

  it('adds +3 for no schema markup', () => {
    const result = scoreDigitalGapFactor(
      buildInput({
        websiteAudit: {
          title: 'Acme',
          metaDescription: 'x',
          ctaPresent: true,
          loadMs: 800,
          deepSignals: { ...baseDeep, hasSchemaMarkup: false, hasReviewSchema: false },
        },
      }),
    );
    // +3 for schema, +2 for review schema (since reviewCount > 50)
    expect(result.score).toBe(5);
  });

  it('adds +2 for generic 3-field contact form', () => {
    const result = scoreDigitalGapFactor(
      buildInput({
        websiteAudit: {
          title: 'Acme',
          metaDescription: 'x',
          ctaPresent: true,
          loadMs: 800,
          deepSignals: { ...baseDeep, formFieldCount: 3 },
        },
      }),
    );
    expect(result.score).toBe(2);
    expect(result.reasoning).toContain('3 fields');
  });

  it('correctly classifies a Logan-Services-style polished site as WARM-bound', () => {
    // Modeled after the Logan Services lead from the conversation:
    // Strong site (title/meta/CTA/fast/social/4.8 rating/4409 reviews/recent)
    // BUT: no chatbot, no booking widget, no estimate calculator, generic form,
    // no schema, no maintenance plan copy.
    const result = scoreDigitalGapFactor({
      enrichmentStatus: 'OK',
      websiteAudit: {
        title: 'HVAC & Plumbing Services in Columbus, OH | Logan Services',
        metaDescription: 'Logan Services proudly offers...',
        ctaPresent: true,
        loadMs: 1124,
        deepSignals: {
          hasChatbot: false,
          hasEstimateCalculator: false,
          hasBookingWidget: false,
          hasSchemaMarkup: false,
          hasReviewSchema: false,
          hasFAQSchema: false,
          formFieldCount: 3,
          emergencyPositioning: 'mentioned',
          detectedCrm: [],
          detectedEmailMarketing: [],
          hasMaintenancePlanCopy: false,
          gapCount: 9,
        },
      },
      socialHandles: { facebook: 'fb', instagram: 'ig' },
      rating: 4.8,
      reviewCount: 4409,
      industry: 'HVAC',
      googleTypes: ['HVAC contractor'],
    });
    // Expected: chatbot(5) + calc(4) + booking(5) + schema(3) + review-schema(2)
    //         + form(2) + crm(2) + email-mkt(2) + maint-plan(2) = 27
    expect(result.score).toBe(27);
    expect(result.score).toBeGreaterThanOrEqual(22); // WARM threshold for opportunity track
  });

  it('keeps NO_WEBSITE legacy behavior intact (+12)', () => {
    const result = scoreDigitalGapFactor({ enrichmentStatus: 'NO_WEBSITE' });
    expect(result.score).toBe(12);
    expect(result.reasoning).toContain('no website');
  });

  it('treats UNREACHABLE as neutral', () => {
    const result = scoreDigitalGapFactor({ enrichmentStatus: 'UNREACHABLE' });
    expect(result.score).toBe(0);
  });

  it('caps total score at 50', () => {
    const result = scoreDigitalGapFactor({
      enrichmentStatus: 'NO_WEBSITE', // +12 — but no audit, so deep signals don't apply
      reviewCount: 5, // +5
      rating: 3.8, // +3
      lastReviewAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000), // +5
    });
    expect(result.score).toBeLessThanOrEqual(50);
    expect(result.maxPossible).toBe(50);
  });
});
