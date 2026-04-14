import type { UpsertPromptConfigDto } from './prompt-config';

export interface Campaign {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  icpProfileId?: string;
  status: 'ACTIVE' | 'PAUSED' | 'DRAFT' | 'ARCHIVED';
  isActive: boolean;
  leadsGenerated: number;
  messagesSent: number;
  replies: number;
  meetings: number;
  conversions: number;
  settings?: CampaignSettings;
  sources?: string[];
  targetIndustries?: string[];
  targetLocations?: string[];
  /** ID of the linked prompt config from the library */
  promptConfigId?: string | null;
  /** Campaign-level overrides applied on top of the linked prompt config */
  promptOverrides?: UpsertPromptConfigDto | null;
  /** Lightweight prompt config reference returned with the campaign */
  promptConfig?: { id: string; name: string; version: number } | null;
  createdAt: string;
  updatedAt: string;
}

/** Typed view of the settings JSON blob stored on Campaign */
export interface CampaignSettings {
  maxLeadsPerDay?: number;
  maxOutreachPerDay?: number;
  targetSources?: string[];
  minIntentConfidence?: number;
  autoApproveWarm?: boolean;
  objective?: CampaignObjective;
  serviceType?: string;
  linkedChannels?: string[];
  outreachTone?: OutreachTone;
  approvalMode?: ApprovalMode;
}

export type CampaignObjective = 'replies' | 'calls_booked' | 'demo_requests' | 'meetings';
export type OutreachTone = 'professional' | 'casual' | 'direct' | 'consultative';
export type ApprovalMode = 'manual' | 'semi_auto' | 'auto';
export type CampaignStatus = 'ACTIVE' | 'PAUSED' | 'DRAFT' | 'ARCHIVED';

export interface CampaignPerformanceMetrics {
  totalLeads: number;
  messagesSent: number;
  /** replied / messagesSent */
  replyRate: number;
  /** converted / totalLeads */
  conversionRate: number;
}

/** Shape returned by GET /api/v1/campaigns/:id/performance */
export interface CampaignPerformance {
  campaignId: string;
  leadsByStatus: Record<string, number>;
  messagesByStatus: Record<string, number>;
  metrics: CampaignPerformanceMetrics;
}

export interface CreateCampaignDto {
  name: string;
  description?: string;
  serviceType?: string;
  /** Required: ICP profile drives targeting (industries, locations, keywords) */
  icpProfileId: string;
  objective?: CampaignObjective;
  linkedChannels?: string[];
  outreachTone?: OutreachTone;
  approvalMode?: ApprovalMode;
  maxLeadsPerDay?: number;
  maxOutreachPerDay?: number;
  targetSources?: string[];
  minIntentConfidence?: number;
  autoApproveWarm?: boolean;
  startAsDraft?: boolean;
  /** UUID of a reusable prompt config from the library to attach */
  promptConfigId?: string | null;
  /** Campaign-level overrides applied on top of the linked prompt config */
  promptOverrides?: UpsertPromptConfigDto | null;
}

export type UpdateCampaignDto = Partial<CreateCampaignDto>;
