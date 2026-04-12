import type { LeadTier } from './lead';

export type MessageStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'QUEUED'
  | 'SENT'
  | 'DELIVERED'
  | 'OPENED'
  | 'CLICKED'
  | 'REPLIED'
  | 'BOUNCED'
  | 'FAILED';

export interface Message {
  id: string;
  leadId: string;
  campaignId?: string | null;
  channel?: string;
  subject: string | null;
  body: string;
  status: MessageStatus;
  spamScore?: number | null;
  uniquenessScore?: number | null;
  aiModel?: string | null;
  aiTokensUsed?: number | null;
  /** Populated only by the pending-approval endpoint */
  lead?: {
    id?: string;
    name: string | null;
    role: string | null;
    company: string | null;
    score?: number | null;
    tier: LeadTier | null;
    source?: string;
  } | null;
  createdAt: string;
  updatedAt?: string;
}
