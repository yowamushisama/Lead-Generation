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

@Injectable()
export class OpenAIProvider implements IAIProvider {
  readonly providerName = 'openai';
  private readonly logger = new Logger(OpenAIProvider.name);
  private readonly client: OpenAI;

  constructor(private readonly config: AppConfigService) {
    this.client = new OpenAI({ apiKey: this.config.openAiApiKey });
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
    const systemPrompt = `You are an expert at detecting buyer intent from social media posts and messages.
Analyze the content and return a JSON object with these exact fields:
{
  "intentType": "BUYING" | "HIRING" | "PARTNERSHIP" | "RESEARCH" | "COMPLAINING" | "COMPARING" | "EXPLORING" | "UNKNOWN",
  "intentUrgency": "IMMEDIATE" | "HIGH" | "MEDIUM" | "LOW" | "NONE",
  "intentConfidence": 0.0-1.0,
  "isBuyer": true/false,
  "intentReasoning": "brief explanation",
  "painPoints": ["array", "of", "pain", "points"],
  "fears": ["array", "of", "fears"],
  "desires": ["array", "of", "desires"],
  "budgetSignal": "budget mention or null",
  "hiringIntent": true/false,
  "companyStage": "startup|growth|enterprise|unknown",
  "technicalLevel": "technical|non-technical|mixed|unknown"
}
Respond ONLY with valid JSON.`;

    const result = await this.complete(content, {
      model: 'gpt-4o-mini',
      systemPrompt,
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
