import { Injectable, Logger } from '@nestjs/common';
import { IPipelineStage } from '../../common/interfaces/pipeline-stage.interface';
import { TenantContext } from '../../common/interfaces/tenant-context.interface';
import { AIProviderFactory } from '../../ai/ai-provider.factory';
import {
  ICP_EXTRACTION_SYSTEM_PROMPT,
  buildICPExtractionPrompt,
} from '../../ai/prompts/icp-extraction.prompt';

export interface ICPEnrichmentInput {
  leadId: string;
  profileContent: string;
  serviceOffering: string;
  classificationModel?: string;
}

export interface ICPEnrichmentOutput {
  leadId: string;
  attributes: {
    role: string;
    seniority: string;
    hasBudgetAuthority: boolean;
    companyStage: string;
    industry: string;
    companySize: string;
    location: string;
    technicalLevel: string;
    painPoints: string[];
    currentSolution: string | null;
    estimatedBudget: string | null;
    decisionTimeline: string;
    icpMatchReasoning: string;
  };
  tokensUsed: number;
}

@Injectable()
export class ICPEnricherStage
  implements IPipelineStage<ICPEnrichmentInput, ICPEnrichmentOutput>
{
  readonly stageName = 'icp-enricher';
  private readonly logger = new Logger(ICPEnricherStage.name);

  constructor(private readonly aiFactory: AIProviderFactory) {}

  async process(input: ICPEnrichmentInput, context: TenantContext): Promise<ICPEnrichmentOutput> {
    const provider = this.aiFactory.getClassificationProvider(input.classificationModel);

    const prompt = buildICPExtractionPrompt(input.profileContent, input.serviceOffering);

    const result = await provider.complete(prompt, {
      systemPrompt: ICP_EXTRACTION_SYSTEM_PROMPT,
      temperature: 0.1,
      maxTokens: 512,
    });

    let attributes: ICPEnrichmentOutput['attributes'];
    try {
      attributes = JSON.parse(result.content);
    } catch {
      this.logger.warn({
        message: 'ICP extraction JSON parse failed — using defaults',
        leadId: input.leadId,
        organizationId: context.organizationId,
      });
      attributes = {
        role: 'Unknown',
        seniority: 'Unknown',
        hasBudgetAuthority: false,
        companyStage: 'Unknown',
        industry: 'Unknown',
        companySize: 'Unknown',
        location: 'Unknown',
        technicalLevel: 'unknown',
        painPoints: [],
        currentSolution: null,
        estimatedBudget: null,
        decisionTimeline: 'unknown',
        icpMatchReasoning: 'Extraction failed',
      };
    }

    this.logger.log({
      message: `ICP enriched: ${attributes.role} at ${attributes.companyStage} stage`,
      leadId: input.leadId,
      organizationId: context.organizationId,
    });

    return { leadId: input.leadId, attributes, tokensUsed: result.tokensUsed };
  }
}
