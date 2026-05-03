import { Injectable, Logger } from '@nestjs/common';
import { TenantContext } from '../../common/interfaces/tenant-context.interface';
import { AIProviderFactory } from '../../ai/ai-provider.factory';
import { AppConfigService } from '../../config/config.service';
import { MessageRepository } from '../../database/repositories/message.repository';
import {
  COLD_CALL_SCRIPT_SYSTEM_PROMPT,
  buildColdCallScriptPrompt,
  ColdCallScriptInput,
} from '../../ai/prompts/cold-call-script.prompt';

export const COLD_CALL_SCRIPT_MESSAGE_TYPE = 'COLD_CALL_SCRIPT';
export const COLD_CALL_SCRIPT_CHANNEL = 'phone';

export interface ColdCallScriptStageInput {
  leadId: string;
  organizationId: string;
  campaignId?: string | null;
  promptInput: ColdCallScriptInput;
  sourcedFromReportId: string;
}

export interface ColdCallScriptStageOutput {
  messageId: string;
}

/**
 * Generates a markdown cold-call script and stores it as a Message row with
 * type='COLD_CALL_SCRIPT'. Designed to be invoked from a try/catch in
 * OutreachProcessor — failures here MUST NOT prevent the email from being saved.
 */
@Injectable()
export class ColdCallScriptGeneratorStage {
  readonly stageName = 'cold-call-script-generator';
  private readonly logger = new Logger(ColdCallScriptGeneratorStage.name);

  constructor(
    private readonly aiFactory: AIProviderFactory,
    private readonly config: AppConfigService,
    private readonly messageRepository: MessageRepository,
  ) {}

  async process(
    input: ColdCallScriptStageInput,
    _context: TenantContext,
  ): Promise<ColdCallScriptStageOutput | null> {
    const provider = this.aiFactory.getPersonalizationProvider(this.config.coldCallModel);

    let aiResult;
    try {
      aiResult = await provider.complete(buildColdCallScriptPrompt(input.promptInput), {
        systemPrompt: COLD_CALL_SCRIPT_SYSTEM_PROMPT,
        temperature: 0.5,
        maxTokens: this.config.coldCallMaxTokens,
        model: this.config.coldCallModel,
      });
    } catch (err) {
      this.logger.warn({
        message: 'Cold-call script AI call failed — non-fatal, no message written',
        leadId: input.leadId,
        organizationId: input.organizationId,
        error: String(err),
      });
      return null;
    }

    const body = aiResult.content.trim();
    if (body.length < 100) {
      this.logger.warn({
        message: 'Cold-call script too short — discarding',
        leadId: input.leadId,
        organizationId: input.organizationId,
        bodyLength: body.length,
      });
      return null;
    }

    const message = await this.messageRepository.create({
      data: {
        organizationId: input.organizationId,
        leadId: input.leadId,
        campaignId: input.campaignId ?? null,
        channel: COLD_CALL_SCRIPT_CHANNEL,
        subject: `Cold call script — ${input.promptInput.company ?? input.promptInput.leadName}`,
        body,
        type: COLD_CALL_SCRIPT_MESSAGE_TYPE,
        status: 'DRAFT',
        aiModel: aiResult.model,
        aiTokensUsed: aiResult.tokensUsed,
        personalContext: {
          sourcedFromReportId: input.sourcedFromReportId,
        } as never,
      },
    });

    this.logger.log({
      message: 'Cold-call script generated',
      leadId: input.leadId,
      organizationId: input.organizationId,
      messageId: message.id,
      tokensUsed: aiResult.tokensUsed,
    });

    return { messageId: message.id };
  }
}
