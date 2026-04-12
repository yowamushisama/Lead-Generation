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

export type LeadSource =
  | 'linkedin'
  | 'google_maps'
  | 'csv'
  | 'webhook'
  | 'reddit'
  | 'manual'
  | 'api';

export interface ScoringFactor {
  name: string;
  weight: number;
  score: number;
  maxPossible: number;
  reasoning: string;
}

export interface ScoringBreakdown {
  factors: ScoringFactor[];
  totalScore: number;
  normalizedScore: number;
  tier: LeadTier;
  computedAt?: string;
}

export interface Lead {
  id: string;
  name: string | null;
  company: string | null;
  role: string | null;
  email: string | null;
  phone?: string | null;
  location: string | null;
  industry?: string | null;
  companySize?: string | null;
  website?: string | null;
  headline?: string | null;
  bio?: string | null;

  // Scoring
  score: number | null;
  tier: LeadTier | null;
  scoreBreakdown?: ScoringBreakdown | null;

  // Status & source
  status: LeadStatus;
  source: LeadSource;
  sourceType: 'intent' | 'discovery';
  sourceUrl?: string | null;

  // Intent signals
  intentType?: string | null;
  intentUrgency?: string | null;
  intentConfidence?: number | null;
  isBuyer?: boolean | null;
  intentReasoning?: string | null;
  budgetSignal?: string | null;
  painPoints?: string[] | null;
  fears?: string[] | null;
  desires?: string[] | null;

  // Discovery (Google Maps)
  rating?: number | null;
  reviewCount?: number | null;
  businessType?: string | null;

  // Personalization
  toneProfile?: string | null;
  recommendedChannel?: string | null;

  // Relationships
  campaignId?: string | null;
  organizationId: string;

  // Compliance
  optedOut?: boolean;

  createdAt: string;
  updatedAt: string;
}

export interface LeadStats {
  total: number;
  byStatus: Record<LeadStatus, number>;
  byTier: { HOT: number; WARM: number; COLD: number };
  bySource: Record<string, number>;
}

export interface LeadFilters {
  status?: LeadStatus;
  tier?: LeadTier;
  source?: LeadSource | 'all';
  campaignId?: string;
  minScore?: number;
  maxScore?: number;
  industry?: string;
  location?: string;
  search?: string;
  createdAfter?: string;
  createdBefore?: string;
  includeOptedOut?: boolean;
  skip?: number;
  limit?: number;
}
