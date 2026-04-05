import { LeadStatus } from '../enums/lead-status.enum';
import { LeadTier } from '../enums/lead-tier.enum';
import { LeadSource } from '../enums/lead-source.enum';
import { IntentResult } from './intent.types';
import { ScoringResult } from './scoring.types';
import { PersonalizationResult } from './personalization.types';

export interface LeadProfile {
  id: string;
  organizationId: string;
  externalId?: string;
  source: LeadSource | string;
  sourceUrl?: string;
  sourceType: string;
  name: string;
  headline?: string;
  bio?: string;
  role?: string;
  company?: string;
  companySize?: string;
  industry?: string;
  location?: string;
  email?: string;
  phone?: string;
  website?: string;
  originalContent?: string;
  intent?: IntentResult;
  scoring?: ScoringResult;
  personalization?: PersonalizationResult;
  status: LeadStatus;
  tier: LeadTier;
  score: number;
  campaignId?: string;
  consentBasis: string;
  optedOut: boolean;
  dataExpiresAt: Date;
  contentHash?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LeadEnrichmentData {
  companyStage?: string;
  technicalLevel?: string;
  budgetSignal?: string;
  hiringIntent?: boolean;
  rating?: number;
  reviewCount?: number;
  businessType?: string;
  placeId?: string;
}
