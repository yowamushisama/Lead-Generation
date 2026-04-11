import { Injectable, Logger } from '@nestjs/common';
import { IPipelineStage } from '../../common/interfaces/pipeline-stage.interface';
import { TenantContext } from '../../common/interfaces/tenant-context.interface';
import { AIProviderFactory } from '../../ai/ai-provider.factory';
import {
  CONVERSATION_SYSTEM_PROMPT,
  buildConversationReplyPrompt,
} from '../../ai/prompts/conversation.prompt';

export interface ConversationStageInput {
  leadId: string;
  conversationId: string;
  conversationHistory: Array<{ role: 'us' | 'them'; content: string; timestamp: string }>;
  latestMessage: string;
  leadProfile: { role?: string; company?: string; painPoints: string[] };
  serviceOffering: string;
  stage: 'initial' | 'follow-up' | 'objection' | 'close';
  personalizationModel?: string;
}

export interface ConversationReply {
  approach: string;
  message: string;
  reasoning: string;
}

export interface ConversationStageOutput {
  leadId: string;
  conversationId: string;
  analysis: string;
  suggestedReplies: ConversationReply[];
  recommendedApproach: number;
  conversationStage: string;
  tokensUsed: number;
}

@Injectable()
export class ConversationAssistantStage implements IPipelineStage<
  ConversationStageInput,
  ConversationStageOutput
> {
  readonly stageName = 'conversation-assistant';
  private readonly logger = new Logger(ConversationAssistantStage.name);

  constructor(private readonly aiFactory: AIProviderFactory) {}

  async process(
    input: ConversationStageInput,
    context: TenantContext,
  ): Promise<ConversationStageOutput> {
    const provider = this.aiFactory.getPersonalizationProvider(input.personalizationModel);

    const prompt = buildConversationReplyPrompt({
      conversationHistory: input.conversationHistory,
      latestMessage: input.latestMessage,
      leadProfile: input.leadProfile,
      serviceOffering: input.serviceOffering,
      stage: input.stage,
    });

    const result = await provider.complete(prompt, {
      systemPrompt: CONVERSATION_SYSTEM_PROMPT,
      temperature: 0.5,
      maxTokens: 768,
    });

    let parsed = {
      analysis: '',
      suggestedReplies: [] as ConversationReply[],
      recommendedApproach: 0,
      conversationStage: 'unknown',
    };

    try {
      parsed = JSON.parse(result.content);
    } catch {
      this.logger.warn({
        message: 'Conversation reply JSON parse failed',
        leadId: input.leadId,
        organizationId: context.organizationId,
      });
    }

    return {
      leadId: input.leadId,
      conversationId: input.conversationId,
      analysis: parsed.analysis,
      suggestedReplies: parsed.suggestedReplies,
      recommendedApproach: parsed.recommendedApproach,
      conversationStage: parsed.conversationStage,
      tokensUsed: result.tokensUsed,
    };
  }
}
