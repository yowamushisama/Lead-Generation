import { registerAs } from '@nestjs/config';

export interface ScoringConfig {
  hotThreshold: number;
  warmThreshold: number;
  maxScore: number;
  weights: {
    intentConfidence: number;
    urgencyLevel: number;
    icpMatch: number;
    companyFit: number;
    engagementSignals: number;
    budgetSignals: number;
    hiringIntent: number;
    buyerRole: number;
  };
}

export default registerAs(
  'scoring',
  (): ScoringConfig => ({
    hotThreshold: parseInt(process.env['SCORE_HOT_THRESHOLD'] ?? '20', 10),
    warmThreshold: parseInt(process.env['SCORE_WARM_THRESHOLD'] ?? '10', 10),
    maxScore: 30,
    weights: {
      intentConfidence: 0.25,
      urgencyLevel: 0.20,
      icpMatch: 0.20,
      companyFit: 0.15,
      engagementSignals: 0.10,
      budgetSignals: 0.05,
      hiringIntent: 0.03,
      buyerRole: 0.02,
    },
  }),
);
