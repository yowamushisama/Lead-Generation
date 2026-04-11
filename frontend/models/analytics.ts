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
  usage: Record<string, number>;
}

/** Shape returned by GET /api/v1/analytics/sources */
export interface SourceBreakdown {
  source: LeadSource;
  count: number;
}

/** Shape returned by GET /api/v1/analytics/trend */
export interface TrendRow {
  date: string;
  leadsProcessed: number;
  aiTokensUsed: number;
}
