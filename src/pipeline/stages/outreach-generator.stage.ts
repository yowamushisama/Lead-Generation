import { Injectable, Logger } from '@nestjs/common';
import { IPipelineStage } from '../../common/interfaces/pipeline-stage.interface';
import { TenantContext } from '../../common/interfaces/tenant-context.interface';
import { AIProviderFactory } from '../../ai/ai-provider.factory';
import { PersonalizationResult } from '../../common/types/personalization.types';
import {
  OUTREACH_SYSTEM_PROMPT,
  ANTI_PATTERN_SYSTEM_PROMPT,
  buildOutreachPrompt,
} from '../../ai/prompts/outreach.prompt';

export interface OutreachGeneratorInput {
  leadId: string;
  recipientName?: string;
  recipientRole?: string;
  personalization: PersonalizationResult;
  serviceOffering: string;
  senderName?: string;
  personalizationModel?: string;
}

export interface GeneratedMessage {
  channel: string;
  subject?: string;
  body: string;
  spamScore: number;
  isApproved: boolean;
  burntPatterns: string[];
}

export interface OutreachGeneratorOutput {
  leadId: string;
  messages: GeneratedMessage[];
  tokensUsed: number;
}

@Injectable()
export class OutreachGeneratorStage implements IPipelineStage<
  OutreachGeneratorInput,
  OutreachGeneratorOutput
> {
  readonly stageName = 'outreach-generator';
  private readonly logger = new Logger(OutreachGeneratorStage.name);

  constructor(private readonly aiFactory: AIProviderFactory) {}

  async process(
    input: OutreachGeneratorInput,
    context: TenantContext,
  ): Promise<OutreachGeneratorOutput> {
    const provider = this.aiFactory.getPersonalizationProvider(input.personalizationModel);
    const { personalization } = input;
    const channels = [personalization.recommendedChannel];
    let totalTokens = 0;
    const messages: GeneratedMessage[] = [];

    for (const channel of channels) {
      const prompt = buildOutreachPrompt({
        channel,
        recipientName: input.recipientName,
        recipientRole: input.recipientRole,
        openingHook: personalization.personalContext.openingHook,
        painPointReference: personalization.personalContext.painPointReference,
        valueProposition: personalization.personalContext.valueProposition,
        callToAction: personalization.personalContext.callToAction,
        toneProfile: personalization.toneProfile,
        socialProof: personalization.personalContext.socialProof,
        senderName: input.senderName,
        serviceOffering: input.serviceOffering,
      });

      const result = await provider.complete(prompt, {
        systemPrompt: OUTREACH_SYSTEM_PROMPT,
        temperature: 0.6,
        maxTokens: 512,
      });

      totalTokens += result.tokensUsed;
      const messageBody = result.content.trim();

      // Anti-pattern check
      const antiPatternResult = await provider.complete(`Message to check:\n\n"${messageBody}"`, {
        systemPrompt: ANTI_PATTERN_SYSTEM_PROMPT,
        temperature: 0.1,
        maxTokens: 256,
      });
      totalTokens += antiPatternResult.tokensUsed;

      let spamCheck = { spamScore: 0, burntPatterns: [] as string[], isApproved: true };
      try {
        spamCheck = JSON.parse(antiPatternResult.content);
      } catch {
        // Use defaults if parse fails
      }

      let subject: string | undefined;
      let body = messageBody;
      if (channel === 'email' && messageBody.startsWith('Subject:')) {
        const lines = messageBody.split('\n');
        subject = lines[0].replace('Subject:', '').trim();
        body = lines.slice(2).join('\n').trim();
      }

      messages.push({
        channel,
        subject,
        body,
        spamScore: spamCheck.spamScore,
        isApproved: spamCheck.isApproved,
        burntPatterns: spamCheck.burntPatterns,
      });
    }

    this.logger.log({
      message: `Outreach generated: ${messages.length} message(s) for lead ${input.leadId}`,
      leadId: input.leadId,
      organizationId: context.organizationId,
      approvedCount: messages.filter((m) => m.isApproved).length,
    });

    return { leadId: input.leadId, messages, tokensUsed: totalTokens };
  }
}
