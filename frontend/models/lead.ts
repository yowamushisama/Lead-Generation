export type LeadTier = 'HOT' | 'WARM' | 'COLD';

export type LeadStatus =
  | 'NEW'
  | 'ENRICHED'
  | 'SCORED'
  | 'PERSONALIZED'
  | 'MESSAGE_DRAFTED'
  | 'MESSAGE_APPROVED'
  | 'OUTREACH_SENT'
  | 'REPLIED'
  | 'MEETING_BOOKED'
  | 'CONVERTED'
  | 'DISQUALIFIED'
  | 'OPT_OUT';

export type LeadSource = 'linkedin' | 'google_maps' | 'csv' | 'webhook';

export interface Lead {
  id: string;
  name: string | null;
  company: string | null;
  role: string | null;
  email: string | null;
  location: string | null;
  score: number | null;
  tier: LeadTier | null;
  status: LeadStatus;
  source: LeadSource;
  sourceType: string;
  rating: number | null;
  reviewCount: number | null;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}
