import { UrgencyLevel } from '../enums/urgency-level.enum';

export type IntentType =
  | 'BUYING'
  | 'HIRING'
  | 'PARTNERSHIP'
  | 'RESEARCH'
  | 'COMPLAINING'
  | 'COMPARING'
  | 'EXPLORING'
  | 'UNKNOWN';

export interface IntentResult {
  intentType: IntentType;
  intentUrgency: UrgencyLevel;
  intentConfidence: number;
  isBuyer: boolean;
  intentReasoning: string;
  painPoints: string[];
  fears: string[];
  desires: string[];
  budgetSignal?: string;
  hiringIntent: boolean;
  companyStage?: string;
  technicalLevel?: string;
}

export interface IntentSignal {
  keyword: string;
  weight: number;
  context: string;
}
