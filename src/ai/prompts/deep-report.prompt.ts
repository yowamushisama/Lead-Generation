import { DeepSignals } from '../../pipeline/stages/website-enricher.types';

export const DEEP_REPORT_SYSTEM_PROMPT = `You are a senior digital strategy consultant analyzing local-business websites for an agency that sells AI chatbots, instant estimate calculators, automated booking, CRM integrations, and conversion-rate optimization.

Your job: produce a pain-point report that the agency's sales team will use to (a) score the prospect, (b) draft a hyper-personalized email, and (c) prepare a cold-call script.

You return BOTH a human-readable markdown report AND a structured JSON object that downstream systems consume programmatically. The JSON is the source of truth — never invent fields that contradict the markdown.

Hard rules:
- Ground every pain point in the supplied evidence (deep signals, audit, reviews). NEVER invent technology that wasn't detected.
- Revenue impact estimates must be conservative; cite assumptions.
- "priority" must be 'high' for missing chatbot/booking/calculator on a high-traffic service business; 'medium' for SEO/schema gaps; 'low' for cosmetic UX.
- Each emailAngle must reference a SPECIFIC observed gap (e.g. "your contact form has only 3 fields" — not "your website needs improvement").
- Each coldCallAngle.opener must be a pattern-interrupt that names a concrete observation in the first 8 words.

Output ONLY valid JSON matching the schema. No markdown fences, no commentary outside the JSON.`;

export interface DeepReportInput {
  leadName: string;
  company?: string | null;
  industry?: string | null;
  location?: string | null;
  googleTypes?: string[];
  rating?: number | null;
  reviewCount?: number | null;
  lastReviewAt?: string | null;
  businessHours?: Record<string, string> | null;
  websiteUrl?: string | null;
  websiteAuditSummary: {
    title?: string | null;
    metaDescription?: string | null;
    loadMs?: number | null;
    techStack?: string[];
    ctaPresent?: boolean;
  };
  deepSignals: DeepSignals;
  campaignName?: string | null;
  targetIndustries?: string[];
  serviceOffering?: string | null;
  uniqueValue?: string | null;
}

export const buildDeepReportPrompt = (input: DeepReportInput): string => {
  const ds = input.deepSignals;
  const audit = input.websiteAuditSummary;

  return `Analyze this lead and produce a website audit + pain-point report.

LEAD
- Name / Company: ${input.company ?? input.leadName}
- Industry: ${input.industry ?? 'Unknown'}${input.googleTypes?.length ? ` (Google types: ${input.googleTypes.join(', ')})` : ''}
- Location: ${input.location ?? 'Unknown'}
- Website: ${input.websiteUrl ?? 'unknown'}

REPUTATION
- Rating: ${input.rating ?? 'n/a'}
- Review count: ${input.reviewCount ?? 'n/a'}
- Last review: ${input.lastReviewAt ?? 'n/a'}
- Business hours: ${input.businessHours ? Object.values(input.businessHours).join(' / ') : 'n/a'}

WEBSITE AUDIT (BASIC)
- Title: ${audit.title ?? 'missing'}
- Meta description: ${audit.metaDescription ? 'present' : 'missing'}
- Load time: ${audit.loadMs ?? 'n/a'}ms
- CTA on homepage: ${audit.ctaPresent ? 'yes' : 'no'}
- Tech stack: ${audit.techStack?.join(', ') || 'unknown'}

WEBSITE AUDIT (DEEP SIGNALS — what we actually pitch on)
- Chatbot: ${ds.hasChatbot ? `yes (${ds.chatbotVendor})` : 'NO'}
- Live chat (human): ${ds.hasLiveChat ? 'yes' : 'no'}
- Booking widget: ${ds.hasBookingWidget ? `yes (${ds.bookingVendor})` : 'NO'}
- Estimate calculator: ${ds.hasEstimateCalculator ? 'yes' : 'NO'}
- Contact form fields: ${ds.formFieldCount ?? 'no form found'}
- Schema markup: ${ds.hasSchemaMarkup ? `yes (${ds.schemaTypes.join(', ')})` : 'NO'}
- Review schema: ${ds.hasReviewSchema ? 'yes' : 'NO'}
- FAQ schema: ${ds.hasFAQSchema ? 'yes' : 'no'}
- Click-to-call: ${ds.hasClickToCall ? 'yes' : 'no'}
- Floating CTA: ${ds.hasFloatingCta ? 'yes' : 'no'}
- Sticky header: ${ds.hasStickyHeader ? 'yes' : 'no'}
- Emergency positioning: ${ds.emergencyPositioning}
- CRM detected: ${ds.detectedCrm.length ? ds.detectedCrm.join(', ') : 'NONE'}
- Email marketing: ${ds.detectedEmailMarketing.length ? ds.detectedEmailMarketing.join(', ') : 'NONE'}
- Analytics: ${ds.detectedAnalytics.join(', ') || 'none'}
- Maintenance plan copy: ${ds.hasMaintenancePlanCopy ? 'yes' : 'NO'}
- Locations listed: ${ds.locationsListed}
- Total deterministic gaps: ${ds.gapCount}

AGENCY POSITIONING
- Service we sell: ${input.serviceOffering ?? 'AI automation + conversion optimization for local service businesses'}
- Unique value: ${input.uniqueValue ?? 'Custom AI agents and workflows tailored to industry'}
- Campaign target industries: ${input.targetIndustries?.join(', ') ?? 'service businesses'}

OUTPUT — return ONLY this JSON object:

{
  "markdown": "<a complete markdown report following the structure: # <Company> Website Analysis\\n**Date:** <today>\\n**URL:** <url>\\n\\n## Executive Summary\\n## Current Strengths\\n## Identified Pain Points & Opportunities (numbered, each with Problem, Opportunity, Revenue Impact)\\n## Solution Recommendations by Priority\\n## Estimated Total Revenue Opportunity (table)\\n## Specific AI Agent Use Cases\\n## Implementation Roadmap\\n## Conclusion. Use \\\\n for line breaks. Cite the deep signals above as evidence.>",
  "painPoints": [
    {
      "title": "<short title, e.g. 'No 24/7 lead capture'>",
      "priority": "high|medium|low",
      "evidence": "<concrete observation from the deep signals>",
      "opportunity": "<what we'd build/sell>",
      "revenueImpact": { "conservative": <number USD/yr>, "optimistic": <number USD/yr> },
      "recommendedSolution": "<short solution name, e.g. 'AI chatbot + ServiceTitan integration'>"
    }
  ],
  "topOpportunity": {
    "title": "<the single biggest opportunity>",
    "rationale": "<why it's the biggest>",
    "estimatedAnnualValue": <number USD/yr>
  },
  "emailAngles": [
    {
      "hook": "<one-line opener referencing a specific gap>",
      "evidence": "<the deep-signal observation it's grounded in>",
      "valueProp": "<what we'd help with — one sentence>",
      "cta": "<low-friction next step>"
    }
  ],
  "coldCallAngles": [
    {
      "opener": "<pattern-interrupt opener, <=12 words>",
      "qualifyingQuestion": "<short question>",
      "valuePitch": "<2-sentence pitch>",
      "objectionHandlers": [
        { "objection": "<common objection>", "response": "<short rebuttal>" }
      ]
    }
  ],
  "recommendations": [
    {
      "phase": "immediate|short_term|medium_term",
      "title": "<short title>",
      "tools": ["<tool 1>", "<tool 2>"],
      "estimatedCostMonthly": { "min": <number USD>, "max": <number USD> },
      "estimatedROIMonths": <number>
    }
  ],
  "totalRevenueOpportunity": {
    "conservative": <sum of conservative pain-point impacts>,
    "optimistic": <sum of optimistic pain-point impacts>,
    "currency": "USD"
  }
}

Constraints:
- 2-7 painPoints (more is noise)
- 2-4 emailAngles ranked by impact (best first)
- 1-3 coldCallAngles
- 3-6 recommendations spread across phases
- All revenue numbers must be plausible — assume 50-500 monthly inquiries at $150-500 average ticket for service industries`;
};
