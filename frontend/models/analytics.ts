import type { LeadSource } from './lead';

/** Shape returned by GET /api/v1/analytics/dashboard */
export interface DashboardData {
  period: string;
  leads: {
    total: number;
    byStatus: Record<string, number>;
    byTier: Record<string, number>;
    hot: number;
    warm: number;
    cold: number;
  };
  outreach: {
    messagesSent: number;
    replyRate: number;
    conversionRate: number;
    byStatus: Record<string, number>;
  };
  usage: {
    /** BigInt serialised as string or number depending on serialiser version */
    aiTokensUsed?: number | string;
    aiCostCents?: number;
    leadsProcessed?: number;
    scrapesExecuted?: number;
    apiCallsMade?: number;
  } | null;
}

/** Shape returned by GET /api/v1/analytics/sources */
export interface SourceBreakdown {
  source: LeadSource;
  count: number;
}

/** Shape returned by GET /api/v1/analytics/trend
 *  aiTokensUsed is a BigInt serialised to string by the backend controller */
export interface TrendRow {
  date: string;
  leadsProcessed: number;
  aiTokensUsed: string;
}

/** Shape returned by GET /api/v1/analytics/funnel */
export interface FunnelStage {
  stage: string;
  count: number;
  dropOff: number;
}
