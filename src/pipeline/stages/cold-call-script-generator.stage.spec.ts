import {
  ColdCallScriptGeneratorStage,
  COLD_CALL_SCRIPT_MESSAGE_TYPE,
} from './cold-call-script-generator.stage';
import { DeepSignals } from './website-enricher.types';

const SCRIPT_MARKDOWN = `# Cold Call Script — Acme Plumbing

## 1. Opener
> "Quick question — your contact form has only 3 fields, right?"

## 2. Permission Line
> "Got 47 seconds?"

## 3. Qualifying Questions
1. How do you handle inquiries after 6pm?
2. Do you currently use any chat tools?
3. What's your average response time?

## 4. Value Pitch
We help plumbers like you capture 24/7 leads with an AI chatbot integrated into ServiceTitan...

## 5. Objection Handlers
| Objection | Response |
|-----------|----------|
| We already have a website | That's exactly why this matters... |

## 6. Close
> "Open Tuesday at 2pm or Thursday at 10am for a quick demo?"

## 7. Voicemail
> "Saw your contact form — quick idea, call back?"`;

describe('ColdCallScriptGeneratorStage', () => {
  function buildStage(options: {
    completeImpl?: () => Promise<{ content: string; tokensUsed: number; model: string; finishReason: string }>;
    captureCreate?: jest.Mock;
  } = {}) {
    const completeImpl =
      options.completeImpl ??
      (async () => ({
        content: SCRIPT_MARKDOWN,
        tokensUsed: 800,
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
      coldCallModel: 'llama-3.3-70b-versatile',
      coldCallMaxTokens: 2000,
    } as never;

    const captureCreate = options.captureCreate ?? jest.fn(async ({ data }) => ({ id: 'msg-1', ...data }));

    const messageRepository = { create: captureCreate } as never;

    return {
      stage: new ColdCallScriptGeneratorStage(aiFactory, config, messageRepository),
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
    hasTeamPage: false,
    hasBlog: false,
    hasCaseStudies: false,
    hasMaintenancePlanCopy: false,
    gapCount: 9,
  };

  const baseInput = {
    leadId: 'lead-1',
    organizationId: 'org-1',
    sourcedFromReportId: 'report-42',
    promptInput: {
      leadName: 'Acme Plumbing',
      company: 'Acme',
      industry: 'Plumbing',
      painPoints: [
        {
          title: 'No 24/7 capture',
          priority: 'high' as const,
          evidence: 'no chatbot',
          opportunity: 'AI chatbot',
          revenueImpact: { conservative: 15000, optimistic: 30000 },
          recommendedSolution: 'AI chatbot',
        },
      ],
      topOpportunity: { title: 'AI chatbot', rationale: 'after-hours leak', estimatedAnnualValue: 25000 },
      coldCallAngles: [
        {
          opener: 'Quick question',
          qualifyingQuestion: 'How do you handle leads after 6pm?',
          valuePitch: 'You\'re losing 40% to voicemail',
          objectionHandlers: [{ objection: 'we have a site', response: 'thats why...' }],
        },
      ],
      deepSignals: baseDeepSignals,
    },
  };

  const ctx = { organizationId: 'org-1', userId: 'user-1', mode: 'SINGLE' as never };

  it('saves a Message with type=COLD_CALL_SCRIPT on success', async () => {
    const { stage, captureCreate } = buildStage();
    const out = await stage.process(baseInput, ctx);

    expect(out).not.toBeNull();
    expect(out!.messageId).toBe('msg-1');

    const data = captureCreate.mock.calls[0][0].data;
    expect(data.type).toBe(COLD_CALL_SCRIPT_MESSAGE_TYPE);
    expect(data.channel).toBe('phone');
    expect(data.body).toContain('Cold Call Script');
    expect(data.personalContext.sourcedFromReportId).toBe('report-42');
    expect(data.aiTokensUsed).toBe(800);
    expect(data.status).toBe('DRAFT');
  });

  it('returns null and writes nothing when AI throws', async () => {
    const { stage, captureCreate } = buildStage({
      completeImpl: async () => {
        throw new Error('rate limit');
      },
    });
    const out = await stage.process(baseInput, ctx);
    expect(out).toBeNull();
    expect(captureCreate).not.toHaveBeenCalled();
  });

  it('discards too-short outputs', async () => {
    const { stage, captureCreate } = buildStage({
      completeImpl: async () => ({
        content: 'too short',
        tokensUsed: 5,
        model: 'm',
        finishReason: 'stop',
      }),
    });
    const out = await stage.process(baseInput, ctx);
    expect(out).toBeNull();
    expect(captureCreate).not.toHaveBeenCalled();
  });
});
