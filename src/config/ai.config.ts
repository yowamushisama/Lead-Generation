import { registerAs } from '@nestjs/config';

export interface AiConfig {
  /** Active provider: groq | openai | anthropic */
  provider: string;
  groqApiKey?: string;
  groqClassificationModel: string;
  groqPersonalizationModel: string;
  openAiApiKey?: string;
  openAiOrgId?: string;
  anthropicApiKey?: string;
  maxTokens: number;
  temperature: number;
  timeoutMs: number;
  retryAttempts: number;
}

export default registerAs(
  'ai',
  (): AiConfig => ({
    provider: process.env['AI_PROVIDER'] ?? 'groq',
    groqApiKey: process.env['GROQ_API_KEY'],
    groqClassificationModel: process.env['GROQ_CLASSIFICATION_MODEL'] ?? 'llama-3.1-8b-instant',
    groqPersonalizationModel: process.env['GROQ_PERSONALIZATION_MODEL'] ?? 'llama-3.3-70b-versatile',
    openAiApiKey: process.env['OPENAI_API_KEY'],
    openAiOrgId: process.env['OPENAI_ORG_ID'],
    anthropicApiKey: process.env['ANTHROPIC_API_KEY'],
    maxTokens: parseInt(process.env['AI_MAX_TOKENS'] ?? '2048', 10),
    temperature: parseFloat(process.env['AI_TEMPERATURE'] ?? '0.7'),
    timeoutMs: parseInt(process.env['AI_TIMEOUT_MS'] ?? '30000', 10),
    retryAttempts: 3,
  }),
);
