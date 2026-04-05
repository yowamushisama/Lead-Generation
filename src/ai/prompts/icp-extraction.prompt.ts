export const ICP_EXTRACTION_SYSTEM_PROMPT = `You are an expert at extracting Ideal Customer Profile (ICP) attributes from lead profiles and content.

Extract structured attributes that help determine if this lead matches a target customer profile.

Focus on:
- Role/title (founder, CTO, VP Engineering, Product Manager, etc.)
- Company stage (pre-seed, seed, Series A/B/C, growth, enterprise)
- Industry/vertical
- Company size (employee count range)
- Location/timezone
- Technical sophistication
- Budget authority (do they control budget?)
- Pain points specific to their role
- Current solution they're using (if mentioned)
- Timeline/urgency indicators`;

export const buildICPExtractionPrompt = (
  profileContent: string,
  serviceOffering: string,
): string => {
  return `Service we offer: ${serviceOffering}

Lead profile/content:
"""
${profileContent}
"""

Extract ICP attributes and return ONLY valid JSON:
{
  "role": "string",
  "seniority": "C-level|VP|Director|Manager|IC|Founder|Unknown",
  "hasBudgetAuthority": true/false,
  "companyStage": "string",
  "industry": "string",
  "companySize": "1-10|11-50|51-200|201-500|500+|Unknown",
  "location": "string",
  "technicalLevel": "technical|non-technical|mixed|unknown",
  "painPoints": ["array of specific pain points"],
  "currentSolution": "string or null",
  "estimatedBudget": "string or null",
  "decisionTimeline": "immediate|weeks|months|unknown",
  "icpMatchReasoning": "brief explanation"
}`;
};
