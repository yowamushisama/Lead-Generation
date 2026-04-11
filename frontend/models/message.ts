import type { LeadTier } from './lead';

export type MessageStatus =
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'SENT'
  | 'REJECTED';

export interface Message {
  id: string;
  leadId: string;
  subject: string | null;
  body: string;
  status: MessageStatus;
  /** Populated only by the pending-approval endpoint */
  lead: {
    name: string | null;
    role: string | null;
    company: string | null;
    score: number | null;
    tier: LeadTier | null;
  };
  createdAt: string;
}
