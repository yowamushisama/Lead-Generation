import { DeepReportGeneratorStage, DeepReportPayload } from './deep-report-generator.stage';
import { DeepSignals } from './website-enricher.types';

const VALID_PAYLOAD: DeepReportPayload = {
  markdown:
    '# Acme Plumbing — Website Analysis\n\n## Executive Summary\nAcme is a strong local plumbing brand with significant digital gaps. The site has no chatbot, no online booking, and a generic 3-field contact form, leaving leads on the table after hours.',
  painPoints: [
    {
      title: 'No 24/7 lead capture',
      priority: 'high',
      evidence: 'Site has no chatbot and contact form is only 3 fields',
      opportunity: 'Deploy AI chatbot + ServiceTitan integration',
      revenueImpact: { conservative: 15000, optimistic: 30000 },
      recommendedSolution: 'AI chatbot integrated with ServiceTitan',
    },
  ],
  topOpportunity: {
    title: 'AI chatbot for after-hours capture',
    rationale: 'Site has no booking widget; 60% of inquiries come outside business hours',
    estimatedAnnualValue: 25000,
  },
  emailAngles: [
    {
      hook: 'Noticed your contact form has only 3 fields',
      evidence: 'No chatbot detected on the homepage',
      valueProp: 'AI chatbot that books appointments 24/7 via ServiceTitan',
      cta: '15-min call to see a demo?',
    },
  ],
  coldCallAngles: [
    {
      opener: 'Quick question about your after-hours leads',
      qualifyingQuestion: 'How do you handle inquiries after 6pm?',
      valuePitch: 'Most plumbers lose 40% of after-hours leads to voicemail',
      objectionHandlers: [{ objection: "We don't need it", response: 'Let me ask what you do today' }],
    },
  ],
  recommendations: [
    {
      phase: 'immediate',
      title: 'AI chatbot deployment',
      tools: ['ManyChat', 'ServiceTitan'],
      estimatedCostMonthly: { min: 500, max: 1500 },
      estimatedROIMonths: 4,
    },
  ],
  totalRevenueOpportunity: { conservative: 15000, optimistic: 30000, currency: 'USD' },
};

describe('DeepReportGeneratorStage', () => {
  function buildStage(overrides: {
    completeImpl?: () => Promise<{ content: string; tokensUsed: number; model: string; finishReason: string }>;
    nextVersion?: number;
    captureCreate?: jest.Mock;
  } = {}) {
    const completeImpl =
      overrides.completeImpl ??
      (async () => ({
        content: JSON.stringify(VALID_PAYLOAD),
        tokensUsed: 1234,
        model: 'llama-3.3-70b-versatile',
        finishReason: 'stop',
      }));

    const aiFactory = {
      getPersonalizationProvider: () => ({
        complete: completeImpl,
        providerName: 'mock',
        classifyIntent: jest.fn(),
      }),
    } as never;

    const config = {
      deepReportModel: 'llama-3.3-70b-versatile',
      deepReportMaxTokens: 4000,
    } as never;

    const version = overrides.nextVersion ?? 1;
    const captureCreate =
      overrides.captureCreate ??
      jest.fn(async (input: { organizationId: string; leadId: string; kind: string; body: string; metadata: unknown }) => ({
        id: 'artifact-1',
        version,
        ...input,
      }));

    const reportRepository = {
      createWithAutoVersion: captureCreate,
    } as never;

    return {
      stage: new DeepReportGeneratorStage(aiFactory, config, reportRepository),
      captureCreate,
    };
  }

  const baseDeepSignals: DeepSignals = {
    hasChatbot: false,
    chatbotVendor: null,
    hasEstimateCalculator: false,
    hasBookingWidget: false,
    bookingVendor: null,
    hasLiveChat: false,
    formFieldCount: 3,
    hasSchemaMarkup: false,
    schemaTypes: [],
    hasReviewSchema: false,
    hasFAQSchema: false,
    hasStickyHeader: false,
    hasClickToCall: true,
    hasFloatingCta: false,
    emergencyPositioning: 'mentioned',
    detectedCrm: [],
    detectedAnalytics: [],
    detectedEmailMarketing: [],
    locationsListed: 1,
    hasTeamPage: true,
    hasBlog: false,
    hasCaseStudies: false,
    hasMaintenancePlanCopy: false,
    gapCount: 9,
  };

  const baseInput = {
    leadId: 'lead-1',
    organizationId: 'org-1',
    promptInput: {
      leadName: 'Acme Plumbing',
      websiteAuditSummary: { ctaPresent: true, loadMs: 1100 },
      deepSignals: baseDeepSignals,
    },
  };

  const ctx = { organizationId: 'org-1', userId: 'user-1', mode: 'SINGLE' as never };

  it('writes a versioned ReportArtifact when JSON is valid', async () => {
    const { stage, captureCreate } = buildStage();
    const out = await stage.process(baseInput, ctx);

    expect(out).not.toBeNull();
    expect(out!.version).toBe(1);
    expect(out!.topPainPointTitle).toBe('No 24/7 lead capture');
    expect(captureCreate).toHaveBeenCalledTimes(1);

    const created = captureCreate.mock.calls[0][0];
    expect(created.kind).toBe('WEBSITE_REPORT');
    expect(created.body.startsWith('#')).toBe(true);
    expect(created.metadata.painPoints).toHaveLength(1);
    expect(created.metadata.emailAngles).toHaveLength(1);
    expect(created.metadata.coldCallAngles).toHaveLength(1);
    expect(created.metadata.deepSignalsSnapshot.gapCount).toBe(9);
  });

  it('increments version on regeneration', async () => {
    const { stage } = buildStage({ nextVersion: 3 });
    const out = await stage.process(baseInput, ctx);
    expect(out!.version).toBe(3);
  });

  it('strips markdown code fences before parsing', async () => {
    const { stage } = buildStage({
      completeImpl: async () => ({
        content: '```json\n' + JSON.stringify(VALID_PAYLOAD) + '\n```',
        tokensUsed: 100,
        model: 'llama-3.3-70b-versatile',
        finishReason: 'stop',
      }),
    });
    const out = await stage.process(baseInput, ctx);
    expect(out).not.toBeNull();
  });

  it('returns null and writes nothing when JSON is invalid', async () => {
    const { stage, captureCreate } = buildStage({
      completeImpl: async () => ({
        content: 'this is not json',
        tokensUsed: 50,
        model: 'llama-3.3-70b-versatile',
        finishReason: 'stop',
      }),
    });
    const out = await stage.process(baseInput, ctx);
    expect(out).toBeNull();
    expect(captureCreate).not.toHaveBeenCalled();
  });

  it('returns null when payload is missing required fields', async () => {
    const broken = { ...VALID_PAYLOAD, painPoints: [] };
    const { stage, captureCreate } = buildStage({
      completeImpl: async () => ({
        content: JSON.stringify(broken),
        tokensUsed: 50,
        model: 'llama-3.3-70b-versatile',
        finishReason: 'stop',
      }),
    });
    const out = await stage.process(baseInput, ctx);
    expect(out).toBeNull();
    expect(captureCreate).not.toHaveBeenCalled();
  });

  it('returns null and does not throw when AI provider fails', async () => {
    const { stage, captureCreate } = buildStage({
      completeImpl: async () => {
        throw new Error('Groq timeout');
      },
    });
    const out = await stage.process(baseInput, ctx);
    expect(out).toBeNull();
    expect(captureCreate).not.toHaveBeenCalled();
  });
});
