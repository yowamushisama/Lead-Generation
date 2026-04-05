export const PERSONALIZATION_SYSTEM_PROMPT = `You are a world-class B2B sales strategist and copywriter.

Your task: Build a deep personalization profile for a lead based on their online presence, content, and intent signals.

You create 4-layer personalization:
1. PERSONAL CONTEXT — What specifically about THIS person triggers the outreach (their exact words/situation)
2. PSYCHOLOGY — Their decision-making style, primary motivations, fears, and desires
3. POSITIONING — How to frame our service specifically for their context and role
4. TONE — The right communication style based on their content and role

Anti-pattern rules:
- NEVER start with "I noticed you posted about..." (overused)
- NEVER use "I hope this finds you well" (spam signal)
- NEVER make the message about us first — lead with their problem
- NEVER use generic value props — tie everything to their specific context`;

export const buildPersonalizationPrompt = (
  leadProfile: {
    name?: string;
    role?: string;
    company?: string;
    originalContent: string;
    painPoints: string[];
    intentReasoning: string;
  },
  serviceOffering: string,
  uniqueValue: string,
): string => {
  return `Our Service: ${serviceOffering}
Our Unique Value: ${uniqueValue}

Lead Profile:
- Name: ${leadProfile.name ?? 'Unknown'}
- Role: ${leadProfile.role ?? 'Unknown'}
- Company: ${leadProfile.company ?? 'Unknown'}
- Their original content: "${leadProfile.originalContent}"
- Detected pain points: ${leadProfile.painPoints.join(', ')}
- Why they're a buyer: ${leadProfile.intentReasoning}

Build a personalization profile. Return ONLY valid JSON:
{
  "personalContext": {
    "openingHook": "specific reference to their situation — NOT generic",
    "painPointReference": "their exact problem in their language",
    "valueProposition": "how we specifically solve their problem",
    "socialProof": "relevant case study or result (can be null)",
    "callToAction": "specific, low-friction next step",
    "toneNotes": "brief tone guidance"
  },
  "psychology": {
    "primaryPainPoint": "string",
    "primaryDesire": "string",
    "primaryFear": "string",
    "motivationStyle": "analytical|driver|expressive|amiable",
    "decisionMakingStyle": "data-driven|intuitive|consensus|authoritative",
    "communicationPreference": "direct|detailed|story-driven|social-proof"
  },
  "positioning": {
    "angle": "the specific angle to take with this person",
    "differentiator": "what makes us the right choice for them specifically",
    "competitiveAdvantage": "string",
    "relevantCaseStudy": "string or null",
    "objectionPreemption": "likely objection and how to address it upfront"
  },
  "toneProfile": "professional-formal|professional-casual|friendly-conversational|direct-assertive|empathetic-consultative",
  "recommendedChannel": "linkedin-dm|twitter-dm|email|reddit-dm"
}`;
};
