import { ColdCallAngle, PainPoint, TopOpportunity } from '../../pipeline/stages/deep-report-generator.stage';
import { DeepSignals } from '../../pipeline/stages/website-enricher.types';

export const COLD_CALL_SCRIPT_SYSTEM_PROMPT = `You are an elite B2B outbound caller writing a script for a sales rep at an AI-automation agency.

Your script must:
- Open with a pattern-interrupt grounded in a SPECIFIC observed gap (not "I noticed your business…").
- Earn permission within the first 15 seconds.
- Lead with the prospect's pain, not our product.
- Anticipate the 3-4 most likely objections for a small/medium service business and disarm them with empathy + evidence.
- Close with a low-friction next step (15-min discovery call), offering two specific time options.
- Include a 15-second voicemail variant.

Output a complete, ready-to-read markdown script. No JSON, no fences, no commentary.`;

export interface ColdCallScriptInput {
  leadName: string;
  company?: string | null;
  industry?: string | null;
  location?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  painPoints: PainPoint[];
  topOpportunity: TopOpportunity;
  coldCallAngles: ColdCallAngle[];
  deepSignals: DeepSignals;
  agencyName?: string;
  callerName?: string;
}

export const buildColdCallScriptPrompt = (input: ColdCallScriptInput): string => {
  const ds = input.deepSignals;
  const observedGaps: string[] = [];
  if (!ds.hasChatbot) observedGaps.push('no chatbot');
  if (!ds.hasBookingWidget) observedGaps.push('no online booking widget');
  if (!ds.hasEstimateCalculator) observedGaps.push('no instant estimate tool');
  if (!ds.hasSchemaMarkup) observedGaps.push('no schema markup for SEO');
  if (ds.detectedCrm.length === 0) observedGaps.push('no CRM detected');
  if (ds.formFieldCount !== null && ds.formFieldCount < 4) observedGaps.push(`only ${ds.formFieldCount}-field contact form`);
  if (ds.emergencyPositioning === 'none') observedGaps.push('no 24/7 emergency framing');

  return `Write a cold-call script for this prospect.

PROSPECT
- Company: ${input.company ?? input.leadName}
- Industry: ${input.industry ?? 'Unknown'}
- Location: ${input.location ?? 'Unknown'}
- Reputation: ${input.rating ? `${input.rating}★` : 'n/a'} / ${input.reviewCount ?? 'n/a'} reviews

OBSERVED WEBSITE GAPS (use these as concrete evidence in the opener)
${observedGaps.length ? observedGaps.map((g) => `- ${g}`).join('\n') : '- (none — focus on review or business-hours signal)'}

TOP OPPORTUNITY
- ${input.topOpportunity.title} — ${input.topOpportunity.rationale}
- Estimated annual value: $${input.topOpportunity.estimatedAnnualValue.toLocaleString()}

PRIORITIZED PAIN POINTS
${input.painPoints
  .slice(0, 4)
  .map((pp, i) => `${i + 1}. [${pp.priority.toUpperCase()}] ${pp.title} — evidence: ${pp.evidence} — solution: ${pp.recommendedSolution}`)
  .join('\n')}

PRE-DRAFTED ANGLES (use as starting points; refine for tone & flow)
${input.coldCallAngles
  .map(
    (a, i) =>
      `Angle ${i + 1}:\n  Opener: ${a.opener}\n  Qualifier: ${a.qualifyingQuestion}\n  Pitch: ${a.valuePitch}`,
  )
  .join('\n\n')}

CALLER CONTEXT
- Caller name: ${input.callerName ?? '[Caller Name]'}
- Agency: ${input.agencyName ?? '[Agency Name]'}

OUTPUT FORMAT — produce exactly this markdown structure:

# Cold Call Script — ${input.company ?? input.leadName}

## 1. Opener (≤12 words, pattern-interrupt)
> "<exact words to say>"

## 2. Permission Line
> "<exact words>"

## 3. Qualifying Questions (3 short)
1. <q1>
2. <q2>
3. <q3>

## 4. Value Pitch (45-60 seconds)
<2-3 short paragraphs grounded in the observed gaps. Use the prospect's industry context.>

## 5. Objection Handlers
| Objection | Response |
|-----------|----------|
| "We already have a website." | <empathic + reframe> |
| "Send me an email." | <hook to keep on call> |
| "We're not interested." | <permission ask + curiosity> |
| "We're too busy / call back later." | <book a specific time> |

## 6. Close
> "<exact words asking for a 15-min discovery call, offering two specific time options>"

## 7. Voicemail (≤15 sec)
> "<short, hook-driven voicemail referencing the same observed gap>"`;
};
