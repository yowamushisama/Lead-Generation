import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import {
  IAIProvider,
  AICompletionOptions,
  AICompletionResult,
} from '../../common/interfaces/ai-provider.interface';
import { TenantContext } from '../../common/interfaces/tenant-context.interface';
import { IntentResult } from '../../common/types/intent.types';
import { AppConfigService } from '../../config/config.service';
import { INTENT_CLASSIFICATION_SYSTEM_PROMPT } from '../prompts/intent-detection.prompt';

@Injectable()
export class ClaudeProvider implements IAIProvider {
  readonly providerName = 'anthropic';
  private readonly logger = new Logger(ClaudeProvider.name);
  private _client: Anthropic | undefined;

  constructor(private readonly config: AppConfigService) {}

  private get client(): Anthropic {
    if (!this._client) {
      const apiKey = this.config.anthropicApiKey;
      if (!apiKey) throw new Error('ANTHROPIC_API_KEY is required — set it or switch AI_PROVIDER');
      this._client = new Anthropic({ apiKey });
    }
    return this._client;
  }

  async complete(prompt: string, options: AICompletionOptions = {}): Promise<AICompletionResult> {
    const model = options.model ?? 'claude-haiku-4-5-20251001';

    const response = await this.client.messages.create({
      model,
      max_tokens: options.maxTokens ?? 1024,
      temperature: options.temperature ?? 0.3,
      system: options.systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0];
    return {
      content: content.type === 'text' ? content.text : '',
      tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
      model,
      finishReason: response.stop_reason ?? 'end_turn',
    };
  }

  async classifyIntent(content: string, context: TenantContext): Promise<IntentResult> {
    const result = await this.complete(content, {
      model: 'claude-haiku-4-5-20251001',
      systemPrompt: INTENT_CLASSIFICATION_SYSTEM_PROMPT,
      temperature: 0.1,
      maxTokens: 512,
    });

    try {
      return JSON.parse(result.content) as IntentResult;
    } catch {
      this.logger.warn({
        message: 'Failed to parse intent JSON',
        organizationId: context.organizationId,
      });
      return {
        intentType: 'UNKNOWN',
        intentUrgency: 'NONE' as never,
        intentConfidence: 0,
        isBuyer: false,
        intentReasoning: 'Failed to classify',
        painPoints: [],
        fears: [],
        desires: [],
        hiringIntent: false,
      };
    }
  }
}
