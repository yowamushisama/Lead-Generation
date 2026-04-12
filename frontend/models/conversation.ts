/** role matches the values stored in the conversation messages JSON:
 *  'us' = sent by us (outbound), 'them' = received from the lead (inbound) */
export interface ConversationMessage {
  role: 'us' | 'them';
  content: string;
  timestamp: string;
}

export interface Conversation {
  id: string;
  organizationId: string;
  leadId: string;
  channel: string;
  messages: ConversationMessage[];
  messageCount: number;
  lastMessageAt: string;
  suggestedReply?: string | null;
  objectionType?: string | null;
  sentiment?: string | null;
  closingStrategy?: string | null;
  status: 'ACTIVE' | 'CLOSED';
  lead?: {
    id: string;
    name: string | null;
    company: string | null;
    role: string | null;
    tier: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

/** Shape returned by GET /api/v1/conversations/:id/reply-suggestions */
export interface ReplySuggestions {
  objectionDetected: boolean;
  objectionType: string | null;
  /** Pre-built deterministic reply for the detected objection, if any */
  deterministicSuggestion: string | null;
  /** AI-generated reply candidates */
  aiSuggestions: string[];
  /** Recommended approach from the AI */
  recommended?: string;
  /** AI analysis of the conversation context */
  analysis?: string;
}
