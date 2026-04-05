import { MessageStatus } from '../enums/message-status.enum';

export type MessageChannel = 'email' | 'linkedin' | 'twitter' | 'sms' | 'whatsapp';

export type MessageType =
  | 'COLD_OUTREACH'
  | 'FOLLOW_UP'
  | 'VALUE_ADD'
  | 'BREAK_UP'
  | 'REFERRAL_REQUEST';

export interface MessageContent {
  subject?: string;
  body: string;
  cta?: string;
  postscript?: string;
}

export interface MessageQualityMetrics {
  spamScore: number;
  uniquenessScore: number;
  readabilityScore: number;
  personalizationScore: number;
}

export interface GeneratedMessage {
  channel: MessageChannel;
  type: MessageType;
  content: MessageContent;
  qualityMetrics: MessageQualityMetrics;
  aiModel: string;
  aiTokensUsed: number;
  promptVersion: string;
}
