import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
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
export class OpenAIProvider implements IAIProvider {
  readonly providerName = 'openai';
  private readonly logger = new Logger(OpenAIProvider.name);
  private readonly client: OpenAI;

  constructor(private readonly config: AppConfigService) {
    this.client = new OpenAI({ apiKey: this.config.openAiApiKey ?? '' });
  }

  async complete(prompt: string, options: AICompletionOptions = {}): Promise<AICompletionResult> {
    const model = options.model ?? 'gpt-4o-mini';
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    if (options.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const response = await this.client.chat.completions.create({
      model,
      messages,
      max_tokens: options.maxTokens ?? 1024,
      temperature: options.temperature ?? 0.3,
    });

    const choice = response.choices[0];
    return {
      content: choice.message.content ?? '',
      tokensUsed: response.usage?.total_tokens ?? 0,
      model,
      finishReason: choice.finish_reason ?? 'stop',
    };
  }

  async classifyIntent(content: string, context: TenantContext): Promise<IntentResult> {
    const result = await this.complete(content, {
      model: 'gpt-4o-mini',
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
      return this.defaultIntentResult();
    }
  }

  private defaultIntentResult(): IntentResult {
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
