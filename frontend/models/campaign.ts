export interface Campaign {
  id: string;
  organizationId: string;
  name: string;
  description?: string;
  icpProfileId?: string;
  status: 'ACTIVE' | 'PAUSED';
  isActive: boolean;
  leadsGenerated: number;
  messagesSent: number;
  replies: number;
  meetings: number;
  conversions: number;
  settings?: Record<string, unknown>;
  sources?: string[];
  targetIndustries?: string[];
  targetLocations?: string[];
  createdAt: string;
  updatedAt: string;
}

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
  icpProfileId?: string;
  maxLeadsPerDay?: number;
  targetSources?: string[];
  targetIndustry?: string;
  targetLocation?: string;
  minIntentConfidence?: number;
  autoApproveWarm?: boolean;
}
