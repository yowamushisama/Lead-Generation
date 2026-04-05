export enum UrgencyLevel {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
  NONE = 'NONE',
}

export const URGENCY_SCORE_MAP: Record<UrgencyLevel, number> = {
  [UrgencyLevel.CRITICAL]: 10,
  [UrgencyLevel.HIGH]: 7,
  [UrgencyLevel.MEDIUM]: 4,
  [UrgencyLevel.LOW]: 2,
  [UrgencyLevel.NONE]: 0,
};
