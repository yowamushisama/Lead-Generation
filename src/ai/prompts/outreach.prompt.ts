export const OUTREACH_SYSTEM_PROMPT = `You are an elite B2B outreach copywriter who writes messages that get replies.

Rules:
1. Under 150 words for first contact (shorter = higher reply rate)
2. Open with THEIR situation, not yours
3. One specific, relevant value mention
4. One clear, easy-to-say-yes-to CTA
5. No attachments, no "let me know if you're interested", no pushy language
6. Sound human — like a founder reaching out personally, not a sales rep

Channel-specific guidelines:
- LinkedIn DM: Professional but warm, reference their post/profile
- Twitter/X DM: Very casual, reference their tweet specifically
- Email: Slightly longer ok, subject line is critical
- Reddit: Community-aware, add value before pitching`;

export interface CampaignOutreachContext {
  customToneInstructions?: string;
  ctaStyle?: string;
  customCta?: string;
  forbiddenPhrases?: string[];
  complianceNotes?: string;
}

/**
 * Structured insight payload sourced from the latest WEBSITE_REPORT artifact's
 * metadata. The outreach prompt uses these fields directly — never the markdown
 * body — so copy/style changes to the report don't break the email.
 */
export interface OutreachReportInsights {
  topPainPointTitle?: string;
  topPainPointEvidence?: string;
  topOpportunity?: string;
  primaryEmailAngle?: {
    hook: string;
    evidence: string;
    valueProp: string;
    cta: string;
  };
  /** A short, fact-grounded sentence the model can quote (e.g. "your contact form has only 3 fields"). */
  deepSignalEvidence?: string;
}

export const buildOutreachPrompt = (
  params: {
    channel: string;
    recipientName?: string;
    recipientRole?: string;
    openingHook: string;
    painPointReference: string;
    valueProposition: string;
    callToAction: string;
    toneProfile: string;
    socialProof?: string;
    senderName?: string;
    serviceOffering: string;
    reportInsights?: OutreachReportInsights;
  },
  campaignContext?: CampaignOutreachContext,
): string => {
  let campaignRules = '';
  if (campaignContext) {
    const lines: string[] = [];
    if (campaignContext.customToneInstructions) lines.push(`- Tone guidance: ${campaignContext.customToneInstructions}`);
    if (campaignContext.ctaStyle === 'custom' && campaignContext.customCta) {
      lines.push(`- CTA to use: "${campaignContext.customCta}"`);
    } else if (campaignContext.ctaStyle && campaignContext.ctaStyle !== 'reply_question') {
      const ctaMap: Record<string, string> = {
        book_call: 'Ask to book a call',
        demo_request: 'Ask for a demo',
      };
      lines.push(`- CTA style: ${ctaMap[campaignContext.ctaStyle] ?? campaignContext.ctaStyle}`);
    }
    if (campaignContext.forbiddenPhrases?.length) {
      lines.push(`- FORBIDDEN phrases (never use): ${campaignContext.forbiddenPhrases.join(', ')}`);
    }
    if (campaignContext.complianceNotes) lines.push(`- Compliance: ${campaignContext.complianceNotes}`);
    if (lines.length) campaignRules = `\nCampaign rules:\n${lines.join('\n')}\n`;
  }

  let reportBlock = '';
  if (params.reportInsights) {
    const r = params.reportInsights;
    const lines: string[] = [];
    if (r.topPainPointTitle) lines.push(`- Top observed pain point: ${r.topPainPointTitle}`);
    if (r.topPainPointEvidence) lines.push(`  Evidence: ${r.topPainPointEvidence}`);
    if (r.topOpportunity) lines.push(`- Top opportunity: ${r.topOpportunity}`);
    if (r.deepSignalEvidence) lines.push(`- Concrete signal you may quote: "${r.deepSignalEvidence}"`);
    if (r.primaryEmailAngle) {
      lines.push(
        `- Suggested angle:`,
        `  Hook: ${r.primaryEmailAngle.hook}`,
        `  Evidence: ${r.primaryEmailAngle.evidence}`,
        `  Value prop: ${r.primaryEmailAngle.valueProp}`,
        `  CTA: ${r.primaryEmailAngle.cta}`,
      );
    }
    if (lines.length) {
      reportBlock = `\nWebsite-audit insights (use the most concrete one in the opener — these are real findings, not invented):\n${lines.join('\n')}\n`;
    }
  }

  return `Channel: ${params.channel}
Tone: ${params.toneProfile}
Service: ${params.serviceOffering}${campaignRules}${reportBlock}
Personalization context:
- Opening hook: ${params.openingHook}
- Their pain point: ${params.painPointReference}
- Value proposition: ${params.valueProposition}
- CTA: ${params.callToAction}
${params.socialProof ? `- Social proof: ${params.socialProof}` : ''}
${params.senderName ? `- Sender name: ${params.senderName}` : ''}

Recipient: ${params.recipientName ?? 'there'} (${params.recipientRole ?? 'decision maker'})

Write a ${params.channel} message. Return ONLY the message text, no JSON wrapping, no subject line label (include subject line inline for email as "Subject: ...\n\n" prefix).`;
};

export const ANTI_PATTERN_SYSTEM_PROMPT = `You are a spam detection system for B2B outreach messages.

Check if a message contains these burnt patterns (score 0-1, where 1 = definite spam):
- Generic openers: "I hope this finds you well", "I came across your profile", "I noticed you"
- Overused CTAs: "Let me know if you're interested", "Would love to connect", "Happy to jump on a call"
- Bragging: "We've helped 500+ companies", "Award-winning", "Industry-leading"
- Pressure: "Limited spots", "This week only", "Don't miss out"
- Vague value: "Boost your productivity", "Scale your business", "Transform your workflow"
- Wall of text: >200 words in first message
- Too many questions: >2 questions in first message

Return ONLY valid JSON:
{
  "spamScore": 0.0-1.0,
  "burntPatterns": ["list of detected patterns"],
  "isApproved": true/false,
  "suggestedFix": "brief suggestion if rejected"
}`;
