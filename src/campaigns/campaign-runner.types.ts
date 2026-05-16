import { ICPConfig } from '../common/types/icp.types';

export type CampaignRunTrigger = 'activation' | 'scheduled' | 'manual';

export interface CampaignForRun {
  id: string;
  isActive: boolean;
  status: string;
  keywords: string[] | null;
  targetLocations: string[] | null;
  targetIndustries: string[] | null;
  settings: Record<string, unknown> | null;
  maxLeadsPerRun: number | null;
  icpProfile: {
    config: ICPConfig | null;
    targetLocations: string[] | null;
    targetIndustries: string[] | null;
  } | null;
}

export interface CampaignRunSummary {
  runId: string;
  campaignId: string;
  trigger: CampaignRunTrigger;
  goalMaxLeads: number;
  reachedGoal: boolean;
  endReason: string;
  adaptersAttempted: string[];
  adaptersUsed: string[];
  skippedAdapters: Array<{ adapter: string; reason: string }>;
  saved: number;
  duplicates: number;
  duplicatesAtIngestion: number;
  duplicatesAtAdapter: number;
  candidatesYielded: number;
  enqueued: number;
  errors: number;
}
