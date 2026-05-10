export interface LeadStats {
  total: number;
  averageScore: number;
  byTier: Record<string, number>;
  byStatus: Record<string, number>;
  bySource: Record<string, number>;
}
