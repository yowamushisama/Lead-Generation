export const ICP_ENHANCE_SYSTEM_PROMPT = `You are an expert B2B sales strategist who builds Ideal Customer Profiles.
Given a profile name, generate a precise, actionable ICP configuration.
Return ONLY valid JSON with no markdown fences or extra text.`;

export const VALID_ICP_STAGES = [
  'pre-seed',
  'seed',
  'series-a',
  'series-b',
  'growth',
  'enterprise',
] as const;

export const buildICPEnhancePrompt = (profileName: string): string => `Profile name: "${profileName}"

Generate a comprehensive ICP configuration JSON:
{
  "targetRoles": [],
  "targetIndustries": [],
  "targetLocations": [],
  "targetStages": [],
  "buyerSignals": [],
  "urgencySignals": [],
  "budgetSignals": []
}

Rules:
- targetRoles: 4-8 specific B2B job titles relevant to the profile name (e.g. "CTO", "VP Engineering")
- targetIndustries: 3-6 industry verticals (e.g. "SaaS", "Fintech", "Healthcare")
- targetLocations: 3-5 geographic markets using country or region names (e.g. "US", "UK", "Canada")
- targetStages: MUST only use values from this exact list: pre-seed, seed, series-a, series-b, growth, enterprise
- buyerSignals: 4-6 short phrases that appear in posts/messages showing purchase intent (e.g. "evaluating vendors", "looking for a solution")
- urgencySignals: 3-5 urgency indicators (e.g. "this quarter", "ASAP", "urgent timeline")
- budgetSignals: 3-5 budget indicators (e.g. "budget approved", "looking to invest", "ROI focused")

Return only the JSON object, no markdown, no explanation.`;
