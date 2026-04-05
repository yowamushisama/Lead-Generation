import { registerAs } from '@nestjs/config';

export interface AiConfig {
  openAiApiKey: string;
  openAiOrgId?: string;
  anthropicApiKey?: string;
  classificationModel: string;
  personalizationModel: string;
  maxTokens: number;
  temperature: number;
  timeoutMs: number;
  retryAttempts: number;
}

export default registerAs(
  'ai',
  (): AiConfig => ({
    openAiApiKey: process.env['OPENAI_API_KEY'] ?? '',
    openAiOrgId: process.env['OPENAI_ORG_ID'],
    anthropicApiKey: process.env['ANTHROPIC_API_KEY'],
    classificationModel: process.env['AI_CLASSIFICATION_MODEL'] ?? 'gpt-4o-mini',
    personalizationModel: process.env['AI_PERSONALIZATION_MODEL'] ?? 'gpt-4o',
    maxTokens: parseInt(process.env['AI_MAX_TOKENS'] ?? '2048', 10),
    temperature: parseFloat(process.env['AI_TEMPERATURE'] ?? '0.7'),
    timeoutMs: parseInt(process.env['AI_TIMEOUT_MS'] ?? '30000', 10),
    retryAttempts: 3,
  }),
);
