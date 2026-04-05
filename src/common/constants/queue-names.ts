export const QUEUE_NAMES = {
  INTENT: 'intent',
  ENRICH: 'enrich',
  SCORE: 'score',
  PERSONALIZE: 'personalize',
  OUTREACH: 'outreach',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export const JOB_NAMES = {
  CLASSIFY_INTENT: 'classify-intent',
  ENRICH_LEAD: 'enrich-lead',
  SCORE_LEAD: 'score-lead',
  PERSONALIZE_LEAD: 'personalize-lead',
  SEND_OUTREACH: 'send-outreach',
  PROCESS_CSV_ROW: 'process-csv-row',
  PROCESS_WEBHOOK: 'process-webhook',
} as const;

export type JobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES];
