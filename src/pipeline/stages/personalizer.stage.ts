import { Injectable, Logger } from '@nestjs/common';
import { IPipelineStage } from '../../common/interfaces/pipeline-stage.interface';
import { TenantContext } from '../../common/interfaces/tenant-context.interface';
import { AIProviderFactory } from '../../ai/ai-provider.factory';
import { PersonalizationResult } from '../../common/types/personalization.types';
import {
  PERSONALIZATION_SYSTEM_PROMPT,
  buildPersonalizationPrompt,
} from '../../ai/prompts/personalization.prompt';

export interface PersonalizerInput {
  leadId: string;
  name?: string;
  role?: string;
  company?: string;
  originalContent: string;
  painPoints: string[];
  intentReasoning: string;
  serviceOffering: string;
  uniqueValue: string;
  personalizationModel?: string;
}

export interface PersonalizerOutput {
  leadId: string;
  personalization: PersonalizationResult;
  tokensUsed: number;
}

@Injectable()
export class PersonalizerStage implements IPipelineStage<PersonalizerInput, PersonalizerOutput> {
  readonly stageName = 'personalizer';
  private readonly logger = new Logger(PersonalizerStage.name);

  constructor(private readonly aiFactory: AIProviderFactory) {}

  async process(input: PersonalizerInput, context: TenantContext): Promise<PersonalizerOutput> {
    const provider = this.aiFactory.getPersonalizationProvider(input.personalizationModel);

    const prompt = buildPersonalizationPrompt(
      {
        name: input.name,
        role: input.role,
        company: input.company,
        originalContent: input.originalContent,
        painPoints: input.painPoints,
        intentReasoning: input.intentReasoning,
      },
      input.serviceOffering,
      input.uniqueValue,
    );

    const result = await provider.complete(prompt, {
      systemPrompt: PERSONALIZATION_SYSTEM_PROMPT,
      temperature: 0.4,
      maxTokens: 1024,
    });

    let personalization: PersonalizationResult;
    try {
      personalization = JSON.parse(result.content) as PersonalizationResult;
    } catch {
      this.logger.warn({
        message: 'Personalization JSON parse failed',
        leadId: input.leadId,
        organizationId: context.organizationId,
      });
      personalization = {
        personalContext: {
          openingHook: `I saw you're looking for ${input.serviceOffering}`,
          painPointReference: input.painPoints[0] ?? 'your challenge',
          valueProposition: input.uniqueValue,
          callToAction: 'Would a quick call make sense?',
          toneNotes: 'professional-casual',
        },
        psychology: {
          primaryPainPoint: input.painPoints[0] ?? '',
          primaryDesire: '',
          primaryFear: '',
          motivationStyle: 'analytical',
          decisionMakingStyle: 'data-driven',
          communicationPreference: 'direct',
        },
        positioning: {
          angle: 'direct value',
          differentiator: input.uniqueValue,
          competitiveAdvantage: '',
          objectionPreemption: '',
        },
        toneProfile: 'professional-casual',
        recommendedChannel: 'linkedin-dm',
      };
    }

    this.logger.log({
      message: `Lead personalized: ${personalization.toneProfile} tone, ${personalization.recommendedChannel} channel`,
      leadId: input.leadId,
      organizationId: context.organizationId,
    });

    return { leadId: input.leadId, personalization, tokensUsed: result.tokensUsed };
  }
}
