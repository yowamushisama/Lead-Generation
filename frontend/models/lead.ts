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

export interface ScoringSignal {
  label: string;
  weight: number;
  category: string;
}

export interface ScoringFactor {
  name: string;
  weight: number;
  score: number;
  maxPossible: number;
  reasoning: string;
  signals?: ScoringSignal[];
}

export interface ScoringBreakdown {
  factors: ScoringFactor[];
  totalScore: number;
  normalizedScore: number;
  tier: LeadTier;
  computedAt?: string;
}

export interface DeepSignals {
  hasChatbot: boolean;
  chatbotVendor: string | null;
  hasEstimateCalculator: boolean;
  hasBookingWidget: boolean;
  bookingVendor: string | null;
  hasLiveChat: boolean;
  formFieldCount: number | null;
  hasSchemaMarkup: boolean;
  schemaTypes: string[];
  hasReviewSchema: boolean;
  hasFAQSchema: boolean;
  hasStickyHeader: boolean;
  hasClickToCall: boolean;
  hasFloatingCta: boolean;
  emergencyPositioning: 'none' | 'mentioned' | 'prominent';
  detectedCrm: string[];
  detectedAnalytics: string[];
  detectedEmailMarketing: string[];
  locationsListed: number;
  hasTeamPage: boolean;
  hasBlog: boolean;
  hasCaseStudies: boolean;
  hasMaintenancePlanCopy: boolean;
  gapCount: number;
}

export interface PainPoint {
  title: string;
  priority: 'high' | 'medium' | 'low';
  evidence: string;
  opportunity: string;
  revenueImpact: { conservative: number; optimistic: number };
  recommendedSolution: string;
}

export interface ReportArtifactSummary {
  id: string;
  organizationId: string;
  leadId: string;
  campaignId: string | null;
  kind: string;
  version: number;
  body: string;
  metadata: {
    model: string;
    tokensUsed: number;
    latencyMs: number;
    deepSignalsSnapshot: DeepSignals;
    painPoints: PainPoint[];
    topOpportunity: { title: string; rationale: string; estimatedAnnualValue: number };
    emailAngles: { hook: string; evidence: string; valueProp: string; cta: string }[];
    coldCallAngles: {
      opener: string;
      qualifyingQuestion: string;
      valuePitch: string;
      objectionHandlers: { objection: string; response: string }[];
    }[];
    recommendations: {
      phase: 'immediate' | 'short_term' | 'medium_term';
      title: string;
      tools: string[];
      estimatedCostMonthly: { min: number; max: number };
      estimatedROIMonths: number;
    }[];
    totalRevenueOpportunity: { conservative: number; optimistic: number; currency: string };
  };
  generatedAt: string;
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
  placeId?: string | null;
  googleTypes?: string[] | null;
  businessHours?: Record<string, string> | null;
  lastReviewAt?: string | null;
  socialHandles?: { instagram?: string; facebook?: string; tiktok?: string } | null;

  // Website enrichment
  websiteAudit?: {
    title: string | null;
    metaDescription: string | null;
    h1Count: number;
    hasViewport: boolean;
    ctaPresent: boolean;
    techStack: string[];
    loadMs: number;
    deepSignals?: DeepSignals;
  } | null;
  enrichmentStatus?: string | null;

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
