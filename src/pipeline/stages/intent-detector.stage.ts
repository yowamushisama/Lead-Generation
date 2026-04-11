import { Injectable, Logger } from '@nestjs/common';
import { IPipelineStage } from '../../common/interfaces/pipeline-stage.interface';
import { TenantContext } from '../../common/interfaces/tenant-context.interface';
import { IntentResult } from '../../common/types/intent.types';
import { AIProviderFactory } from '../../ai/ai-provider.factory';
import {
  buildIntentPrompt,
  INTENT_DETECTION_SYSTEM_PROMPT,
} from '../../ai/prompts/intent-detection.prompt';

export interface IntentStageInput {
  leadId: string;
  originalContent: string;
  platform: string;
  classificationModel?: string;
}

export interface IntentStageOutput {
  leadId: string;
  intent: IntentResult;
  tokensUsed: number;
}

@Injectable()
export class IntentDetectorStage implements IPipelineStage<IntentStageInput, IntentStageOutput> {
  readonly stageName = 'intent-detector';
  private readonly logger = new Logger(IntentDetectorStage.name);

  constructor(private readonly aiFactory: AIProviderFactory) {}

  async process(input: IntentStageInput, context: TenantContext): Promise<IntentStageOutput> {
    const provider = this.aiFactory.getClassificationProvider(input.classificationModel);

    const prompt = buildIntentPrompt(input.originalContent, input.platform);

    const result = await provider.complete(prompt, {
      systemPrompt: INTENT_DETECTION_SYSTEM_PROMPT,
      temperature: 0.1,
      maxTokens: 512,
    });

    let intent: IntentResult;
    try {
      intent = JSON.parse(result.content) as IntentResult;
    } catch {
      this.logger.warn({
        message: 'Intent JSON parse failed — using fallback',
        leadId: input.leadId,
        organizationId: context.organizationId,
      });
      intent = {
        intentType: 'UNKNOWN',
        intentUrgency: 'NONE' as never,
        intentConfidence: 0,
        isBuyer: false,
        intentReasoning: 'Parse error',
        painPoints: [],
        fears: [],
        desires: [],
        hiringIntent: false,
      };
    }

    this.logger.log({
      message: `Intent classified: ${intent.intentType} (${(intent.intentConfidence * 100).toFixed(0)}%)`,
      leadId: input.leadId,
      organizationId: context.organizationId,
      intentType: intent.intentType,
      confidence: intent.intentConfidence,
    });

    return { leadId: input.leadId, intent, tokensUsed: result.tokensUsed };
  }
}
