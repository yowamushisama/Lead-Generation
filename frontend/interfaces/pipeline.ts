export type PipelineStageId =
  | 'intent'
  | 'enrich'
  | 'score'
  | 'personalize'
  | 'outreach';

export interface PipelineStage {
  id: PipelineStageId;
  label: string;
  queueName: string;
  leadCount: number;
  processedToday: number;
  failedToday: number;
  avgProcessingMs?: number;
  status: 'idle' | 'active' | 'degraded' | 'error';
}

export interface DiagnosticLog {
  id: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  stage?: PipelineStageId;
  message: string;
  leadId?: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

export interface FailedJob {
  id: string;
  queueName: string;
  jobName: string;
  leadId?: string;
  error: string;
  failedAt: string;
  attempts: number;
}
