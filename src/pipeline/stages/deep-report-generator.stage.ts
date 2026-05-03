import { Injectable, Logger } from '@nestjs/common';
import { TenantContext } from '../../common/interfaces/tenant-context.interface';
import { AIProviderFactory } from '../../ai/ai-provider.factory';
import { AppConfigService } from '../../config/config.service';
import { ReportArtifactRepository } from '../../database/repositories/report-artifact.repository';
import {
  DEEP_REPORT_SYSTEM_PROMPT,
  buildDeepReportPrompt,
  DeepReportInput,
} from '../../ai/prompts/deep-report.prompt';
import { DeepSignals } from './website-enricher.types';

export interface PainPoint {
  title: string;
  priority: 'high' | 'medium' | 'low';
  evidence: string;
  opportunity: string;
  revenueImpact: { conservative: number; optimistic: number };
  recommendedSolution: string;
}

export interface EmailAngle {
  hook: string;
  evidence: string;
  valueProp: string;
  cta: string;
}

export interface ColdCallAngle {
  opener: string;
  qualifyingQuestion: string;
  valuePitch: string;
  objectionHandlers: { objection: string; response: string }[];
}

export interface TopOpportunity {
  title: string;
  rationale: string;
  estimatedAnnualValue: number;
}

export interface Recommendation {
  phase: 'immediate' | 'short_term' | 'medium_term';
  title: string;
  tools: string[];
  estimatedCostMonthly: { min: number; max: number };
  estimatedROIMonths: number;
}

export interface DeepReportPayload {
  markdown: string;
  painPoints: PainPoint[];
  topOpportunity: TopOpportunity;
  emailAngles: EmailAngle[];
  coldCallAngles: ColdCallAngle[];
  recommendations: Recommendation[];
  totalRevenueOpportunity: { conservative: number; optimistic: number; currency: string };
}

export interface DeepReportArtifactMetadata extends Omit<DeepReportPayload, 'markdown'> {
  model: string;
  tokensUsed: number;
  latencyMs: number;
  deepSignalsSnapshot: DeepSignals;
}

export interface DeepReportStageInput {
  leadId: string;
  organizationId: string;
  campaignId?: string | null;
  promptInput: DeepReportInput;
}

export interface DeepReportStageOutput {
  artifactId: string;
  version: number;
  topPainPointTitle: string | null;
}

@Injectable()
export class DeepReportGeneratorStage {
  readonly stageName = 'deep-report-generator';
  private readonly logger = new Logger(DeepReportGeneratorStage.name);

  constructor(
    private readonly aiFactory: AIProviderFactory,
    private readonly config: AppConfigService,
    private readonly reportRepository: ReportArtifactRepository,
  ) {}

  /**
   * Pre-filter applied OUTSIDE this stage's process() call:
   * - config.enableDeepReport must be true
   * - lead.source must be GOOGLE_MAPS
   * - lead.enrichmentStatus must be 'OK'
   * - websiteAudit.deepSignals.gapCount >= 2
   *
   * The enrichment processor performs those checks. The stage itself only runs
   * once we've decided it's worth burning tokens.
   */
  async process(
    input: DeepReportStageInput,
    _context: TenantContext,
  ): Promise<DeepReportStageOutput | null> {
    const start = Date.now();
    const provider = this.aiFactory.getPersonalizationProvider(this.config.deepReportModel);

    let aiResult;
    try {
      aiResult = await provider.complete(buildDeepReportPrompt(input.promptInput), {
        systemPrompt: DEEP_REPORT_SYSTEM_PROMPT,
        temperature: 0.3,
        maxTokens: this.config.deepReportMaxTokens,
        model: this.config.deepReportModel,
      });
    } catch (err) {
      this.logger.warn({
        message: 'Deep report AI call failed — continuing without artifact',
        leadId: input.leadId,
        organizationId: input.organizationId,
        error: String(err),
      });
      return null;
    }

    const latencyMs = Date.now() - start;

    const payload = this.parseAndValidate(aiResult.content);
    if (!payload) {
      this.logger.warn({
        message: 'Deep report JSON parse/validation failed — no artifact written',
        leadId: input.leadId,
        organizationId: input.organizationId,
      });
      return null;
    }

    const metadata: DeepReportArtifactMetadata = {
      model: aiResult.model,
      tokensUsed: aiResult.tokensUsed,
      latencyMs,
      deepSignalsSnapshot: input.promptInput.deepSignals,
      painPoints: payload.painPoints,
      topOpportunity: payload.topOpportunity,
      emailAngles: payload.emailAngles,
      coldCallAngles: payload.coldCallAngles,
      recommendations: payload.recommendations,
      totalRevenueOpportunity: payload.totalRevenueOpportunity,
    };

    const artifact = await this.reportRepository.createWithAutoVersion({
      organizationId: input.organizationId,
      leadId: input.leadId,
      campaignId: input.campaignId ?? null,
      kind: 'WEBSITE_REPORT',
      body: payload.markdown,
      metadata: metadata as never,
    });

    this.logger.log({
      message: `Deep report generated v${artifact.version}`,
      leadId: input.leadId,
      organizationId: input.organizationId,
      artifactId: artifact.id,
      tokensUsed: aiResult.tokensUsed,
      latencyMs,
      painPoints: payload.painPoints.length,
    });

    return {
      artifactId: artifact.id,
      version: artifact.version,
      topPainPointTitle: payload.painPoints[0]?.title ?? null,
    };
  }

  /** Hand-rolled validation — keeps us off the zod dependency. */
  private parseAndValidate(raw: string): DeepReportPayload | null {
    let parsed: unknown;
    try {
      // Models occasionally wrap JSON in fences despite instructions
      const cleaned = raw
        .trim()
        .replace(/^```(?:json)?\s*/, '')
        .replace(/\s*```$/, '');
      parsed = JSON.parse(cleaned);
    } catch {
      return null;
    }

    if (!parsed || typeof parsed !== 'object') return null;
    const obj = parsed as Record<string, unknown>;

    if (typeof obj.markdown !== 'string' || obj.markdown.length < 50) return null;
    if (!Array.isArray(obj.painPoints) || obj.painPoints.length === 0) return null;
    if (!Array.isArray(obj.emailAngles) || obj.emailAngles.length === 0) return null;
    if (!Array.isArray(obj.coldCallAngles) || obj.coldCallAngles.length === 0) return null;
    if (!Array.isArray(obj.recommendations)) return null;

    const topOp = obj.topOpportunity as Record<string, unknown> | undefined;
    if (
      !topOp ||
      typeof topOp.title !== 'string' ||
      typeof topOp.rationale !== 'string' ||
      typeof topOp.estimatedAnnualValue !== 'number'
    ) return null;

    const totalRev = obj.totalRevenueOpportunity as Record<string, unknown> | undefined;
    if (
      !totalRev ||
      typeof totalRev.conservative !== 'number' ||
      typeof totalRev.optimistic !== 'number' ||
      typeof totalRev.currency !== 'string'
    ) return null;

    // Validate each pain point structurally
    for (const pp of obj.painPoints as unknown[]) {
      if (!this.isPainPoint(pp)) return null;
    }
    for (const ea of obj.emailAngles as unknown[]) {
      if (!this.isEmailAngle(ea)) return null;
    }
    for (const cca of obj.coldCallAngles as unknown[]) {
      if (!this.isColdCallAngle(cca)) return null;
    }
    for (const rec of obj.recommendations as unknown[]) {
      if (!this.isRecommendation(rec)) return null;
    }

    return {
      markdown: obj.markdown,
      painPoints: obj.painPoints as PainPoint[],
      topOpportunity: obj.topOpportunity as TopOpportunity,
      emailAngles: obj.emailAngles as EmailAngle[],
      coldCallAngles: obj.coldCallAngles as ColdCallAngle[],
      recommendations: obj.recommendations as Recommendation[],
      totalRevenueOpportunity: obj.totalRevenueOpportunity as DeepReportPayload['totalRevenueOpportunity'],
    };
  }

  private isPainPoint(v: unknown): v is PainPoint {
    if (!v || typeof v !== 'object') return false;
    const o = v as Record<string, unknown>;
    const ri = o.revenueImpact as Record<string, unknown> | undefined;
    return (
      typeof o.title === 'string' &&
      typeof o.evidence === 'string' &&
      typeof o.opportunity === 'string' &&
      typeof o.recommendedSolution === 'string' &&
      ['high', 'medium', 'low'].includes(o.priority as string) &&
      typeof ri?.conservative === 'number' &&
      typeof ri?.optimistic === 'number'
    );
  }

  private isRecommendation(v: unknown): v is Recommendation {
    if (!v || typeof v !== 'object') return false;
    const o = v as Record<string, unknown>;
    const cost = o.estimatedCostMonthly as Record<string, unknown> | undefined;
    return (
      ['immediate', 'short_term', 'medium_term'].includes(o.phase as string) &&
      typeof o.title === 'string' &&
      Array.isArray(o.tools) &&
      typeof cost?.min === 'number' &&
      typeof cost?.max === 'number' &&
      typeof o.estimatedROIMonths === 'number'
    );
  }

  private isEmailAngle(v: unknown): v is EmailAngle {
    if (!v || typeof v !== 'object') return false;
    const o = v as Record<string, unknown>;
    return (
      typeof o.hook === 'string' &&
      typeof o.evidence === 'string' &&
      typeof o.valueProp === 'string' &&
      typeof o.cta === 'string'
    );
  }

  private isColdCallAngle(v: unknown): v is ColdCallAngle {
    if (!v || typeof v !== 'object') return false;
    const o = v as Record<string, unknown>;
    return (
      typeof o.opener === 'string' &&
      typeof o.qualifyingQuestion === 'string' &&
      typeof o.valuePitch === 'string' &&
      Array.isArray(o.objectionHandlers)
    );
  }
}
