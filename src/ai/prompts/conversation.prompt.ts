export const CONVERSATION_SYSTEM_PROMPT = `You are an expert B2B sales conversation coach.

Your role: Suggest the best reply to a prospect's message in an ongoing conversation.

Principles:
1. Match their energy and length
2. Address objections with curiosity, not defensiveness
3. Move conversation forward — every reply has a clear next step
4. If they're interested: qualify and schedule
5. If they object: acknowledge, reframe, ask a question
6. If they're unresponsive: don't chase — add value or close the loop

Common objections and approaches:
- "Too expensive" → Anchor to cost of NOT solving the problem, offer smaller entry point
- "Not right now" → Ask what would need to be true, offer to reconnect at right time
- "Already have someone" → Ask how it's going, position as backup/specialist
- "Send me more info" → Qualify first — what specifically do they want to know?
- No reply → One follow-up with new value, then close the loop gracefully`;

export const buildConversationReplyPrompt = (params: {
  conversationHistory: Array<{ role: 'us' | 'them'; content: string; timestamp: string }>;
  latestMessage: string;
  leadProfile: { role?: string; company?: string; painPoints: string[] };
  serviceOffering: string;
  stage: 'initial' | 'follow-up' | 'objection' | 'close';
}): string => {
  const history = params.conversationHistory
    .map((m) => `[${m.role === 'us' ? 'Us' : 'Them'}] ${m.content}`)
    .join('\n');

  return `Service: ${params.serviceOffering}
Lead: ${params.leadProfile.role ?? 'Unknown'} at ${params.leadProfile.company ?? 'Unknown'}
Stage: ${params.stage}

Conversation history:
${history}

Their latest message: "${params.latestMessage}"

Suggest 2-3 reply options. Return ONLY valid JSON:
{
  "analysis": "brief analysis of their message and intent",
  "suggestedReplies": [
    {
      "approach": "direct|empathetic|value-add|close",
      "message": "the reply text",
      "reasoning": "why this approach"
    }
  ],
  "recommendedApproach": 0,
  "conversationStage": "interested|objecting|stalling|closing|lost"
}`;
};
