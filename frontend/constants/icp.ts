export const SCORING_FACTORS = [
  { key: 'intent',   label: 'Intent Strength',  color: '#06B6D4', max: 30 },
  { key: 'urgency',  label: 'Urgency Signals',   color: '#EF4444', max: 15 },
  { key: 'role',     label: 'Role Fit',          color: '#7C3AED', max: 20 },
  { key: 'recency',  label: 'Recency',           color: '#F59E0B', max: 15 },
  { key: 'budget',   label: 'Budget Indicators', color: '#10B981', max: 15 },
  { key: 'icp',      label: 'ICP Fit',           color: '#F97316', max: 20 },
  { key: 'negative', label: 'Negative Signals',  color: '#94A3B8', max: -30 },
] as const;

export const COMPANY_STAGES = [
  'pre-seed',
  'seed',
  'series-a',
  'series-b',
  'growth',
  'enterprise',
] as const;

export type CompanyStage = (typeof COMPANY_STAGES)[number];
