import { TenantContext } from './tenant-context.interface';
import { IntentResult } from '../types/intent.types';

export interface AICompletionOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
  timeoutMs?: number;
}

export interface AICompletionResult {
  content: string;
  tokensUsed: number;
  model: string;
  finishReason: string;
}

export interface IAIProvider {
  readonly providerName: string;
  complete(prompt: string, options: AICompletionOptions): Promise<AICompletionResult>;
  classifyIntent(content: string, context: TenantContext): Promise<IntentResult>;
}
