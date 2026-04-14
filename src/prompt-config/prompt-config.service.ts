import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { AIProviderFactory } from '../ai/ai-provider.factory';
import {
  PERSONALIZATION_SYSTEM_PROMPT,
  buildPersonalizationPrompt,
} from '../ai/prompts/personalization.prompt';
import {
  OUTREACH_SYSTEM_PROMPT,
  ANTI_PATTERN_SYSTEM_PROMPT,
  buildOutreachPrompt,
} from '../ai/prompts/outreach.prompt';
import { UpsertPromptConfigDto } from './dto/upsert-prompt-config.dto';
import { CreatePromptConfigDto } from './dto/create-prompt-config.dto';
import { UpdatePromptConfigDto } from './dto/update-prompt-config.dto';
import { PreviewRequestDto } from './dto/preview-request.dto';
import type { PromptConfig } from '@prisma/client';
import {
  PromptConfigSnapshotData,
  sanitizePromptConfigOverrides,
} from './prompt-config-overrides.util';

export interface PromptConfigSnapshot {
  version: number;
  savedAt: string;
  data: PromptConfigSnapshotData;
}

export interface PreviewResult {
  personalization: {
    openingHook: string;
    painPointReference: string;
    valueProposition: string;
    callToAction: string;
    toneProfile: string;
    channel: string;
  };
  outreachMessage: string;
  channel: string;
  spamScore: number;
  isApproved: boolean;
}

@Injectable()
export class PromptConfigService {
  private readonly logger = new Logger(PromptConfigService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiFactory: AIProviderFactory,
  ) {}

  // ── Ownership helpers ───────────────────────────────────────────────────────

  private async assertOwnership(tenant: TenantContext, id: string): Promise<PromptConfig> {
    const config = await this.prisma.promptConfig.findFirst({
      where: { id, organizationId: tenant.organizationId },
    });
    if (!config) {
      throw new NotFoundException(`Prompt config ${id} not found`);
    }
    return config;
  }

  // ── List ────────────────────────────────────────────────────────────────────

  async list(tenant: TenantContext): Promise<(PromptConfig & { _count: { campaigns: number } })[]> {
    return this.prisma.promptConfig.findMany({
      where: { organizationId: tenant.organizationId },
      include: { _count: { select: { campaigns: true } } },
      orderBy: { updatedAt: 'desc' },
    }) as Promise<(PromptConfig & { _count: { campaigns: number } })[]>;
  }

  // ── Create ──────────────────────────────────────────────────────────────────

  async create(tenant: TenantContext, dto: CreatePromptConfigDto): Promise<PromptConfig> {
    return this.prisma.promptConfig.create({
      data: {
        organizationId: tenant.organizationId,
        name: dto.name,
        description: dto.description,
        ...this.buildUpdateData(dto),
        version: 1,
        history: [],
      },
    });
  }

  // ── Find by ID ──────────────────────────────────────────────────────────────

  async findById(tenant: TenantContext, id: string): Promise<PromptConfig> {
    return this.assertOwnership(tenant, id);
  }

  // ── Update ──────────────────────────────────────────────────────────────────

  async update(
    tenant: TenantContext,
    id: string,
    dto: UpdatePromptConfigDto,
  ): Promise<PromptConfig> {
    const existing = await this.assertOwnership(tenant, id);

    const snapshot: PromptConfigSnapshot = {
      version: existing.version,
      savedAt: new Date().toISOString(),
      data: this.extractSnapshotData(existing),
    };
    const history = [...((existing.history as unknown as PromptConfigSnapshot[]) ?? []), snapshot];

    const data: Record<string, unknown> = {
      ...this.buildUpdateData(dto),
      version: { increment: 1 },
      history: history as never,
    };
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;

    return this.prisma.promptConfig.update({
      where: { id },
      data: data as never,
    });
  }

  // ── Archive ─────────────────────────────────────────────────────────────────

  async archive(tenant: TenantContext, id: string): Promise<PromptConfig> {
    await this.assertOwnership(tenant, id);
    return this.prisma.promptConfig.update({
      where: { id },
      data: { status: 'archived' },
    });
  }

  // ── Clone ───────────────────────────────────────────────────────────────────

  async clone(tenant: TenantContext, id: string): Promise<PromptConfig> {
    const source = await this.assertOwnership(tenant, id);
    return this.prisma.promptConfig.create({
      data: {
        organizationId: tenant.organizationId,
        name: `Copy of ${source.name}`,
        description: source.description,
        companyDescription: source.companyDescription,
        coreOffer: source.coreOffer,
        targetPersona: source.targetPersona,
        mainPainSolved: source.mainPainSolved,
        mainOutcomePromised: source.mainOutcomePromised,
        proofPoints: source.proofPoints ?? [],
        preferredTone: source.preferredTone,
        customToneInstructions: source.customToneInstructions,
        ctaStyle: source.ctaStyle,
        customCta: source.customCta,
        forbiddenPhrases: source.forbiddenPhrases ?? [],
        forbiddenClaims: source.forbiddenClaims ?? [],
        complianceNotes: source.complianceNotes,
        personalizationPromptOverride: source.personalizationPromptOverride,
        outreachPromptOverride: source.outreachPromptOverride,
        version: 1,
        history: [],
      },
    });
  }

  // ── History ─────────────────────────────────────────────────────────────────

  async getHistory(tenant: TenantContext, id: string): Promise<PromptConfigSnapshot[]> {
    const config = await this.assertOwnership(tenant, id);
    return (config.history as unknown as PromptConfigSnapshot[]) ?? [];
  }

  // ── Restore ────────────────────────────────────────────────────────────────

  async restoreVersion(
    tenant: TenantContext,
    id: string,
    targetVersion: number,
  ): Promise<PromptConfig> {
    const config = await this.assertOwnership(tenant, id);

    const history = (config.history as unknown as PromptConfigSnapshot[]) ?? [];
    const snapshot = history.find((h) => h.version === targetVersion);
    if (!snapshot) {
      throw new NotFoundException(`Version ${targetVersion} not found in history`);
    }

    const currentSnapshot: PromptConfigSnapshot = {
      version: config.version,
      savedAt: new Date().toISOString(),
      data: this.extractSnapshotData(config),
    };
    const updatedHistory = [...history, currentSnapshot];

    return this.prisma.promptConfig.update({
      where: { id },
      data: {
        ...this.buildUpdateData(snapshot.data as UpsertPromptConfigDto),
        name: snapshot.data.name ?? config.name,
        description: snapshot.data.description ?? null,
        status: snapshot.data.status ?? config.status,
        version: { increment: 1 },
        history: updatedHistory as never,
      },
    });
  }

  // ── Preview ────────────────────────────────────────────────────────────────

  async preview(
    tenant: TenantContext,
    id: string,
    dto: PreviewRequestDto,
  ): Promise<PreviewResult> {
    const base = await this.assertOwnership(tenant, id);

    // Merge: base → campaignOverrides → configOverride (unsaved form edits)
    const effective = {
      ...base,
      ...(dto.campaignOverrides ?? {}),
      ...(dto.configOverride ?? {}),
    } as Partial<PromptConfig> & UpsertPromptConfigDto;

    return this._runPreview(effective, dto);
  }

  // ── Pipeline helper: resolve effective config for a campaign ────────────────

  /** Used by pipeline stages. Loads campaign → resolves promptConfig → merges campaign overrides. */
  async findEffectiveForCampaign(
    tenant: TenantContext,
    campaignId: string,
  ): Promise<PromptConfig | null> {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id: campaignId, organizationId: tenant.organizationId },
      select: { promptConfigId: true, promptOverrides: true },
    });

    if (!campaign?.promptConfigId) return null;

    const config = await this.prisma.promptConfig.findFirst({
      where: { id: campaign.promptConfigId, organizationId: tenant.organizationId },
    });
    if (!config) {
      this.logger.warn(
        `Campaign ${campaignId} references prompt config ${campaign.promptConfigId} outside organization ${tenant.organizationId} or missing`,
      );
      return null;
    }

    return this.mergeWithOverrides(config, campaign.promptOverrides as Record<string, unknown> | null);
  }

  // ── System prompt builders ─────────────────────────────────────────────────

  buildEffectivePersonalizationSystemPrompt(config: PromptConfig | null): string {
    if (config?.personalizationPromptOverride) {
      return config.personalizationPromptOverride;
    }

    let prompt = PERSONALIZATION_SYSTEM_PROMPT;

    if (config?.complianceNotes) {
      prompt += `\n\nCompliance requirements:\n${config.complianceNotes}`;
    }

    return prompt;
  }

  buildEffectiveOutreachSystemPrompt(config: PromptConfig | null): string {
    if (config?.outreachPromptOverride) {
      return config.outreachPromptOverride;
    }

    let prompt = OUTREACH_SYSTEM_PROMPT;

    if (config?.forbiddenPhrases && (config.forbiddenPhrases as string[]).length > 0) {
      const phrases = (config.forbiddenPhrases as string[]).join(', ');
      prompt += `\n\nFORBIDDEN phrases — never use these: ${phrases}`;
    }

    if (config?.forbiddenClaims && (config.forbiddenClaims as string[]).length > 0) {
      const claims = (config.forbiddenClaims as string[]).join(', ');
      prompt += `\n\nFORBIDDEN claims — never make these: ${claims}`;
    }

    if (config?.complianceNotes) {
      prompt += `\n\nCompliance requirements:\n${config.complianceNotes}`;
    }

    return prompt;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /** Shallow-merges campaign-level overrides onto a base config, returning a virtual merged record. */
  mergeWithOverrides(
    config: PromptConfig,
    overrides: Record<string, unknown> | null | undefined,
  ): PromptConfig {
    const sanitizedOverrides = sanitizePromptConfigOverrides(overrides);
    if (!sanitizedOverrides) return config;
    return { ...config, ...sanitizedOverrides } as PromptConfig;
  }

  private async _runPreview(
    effective: Partial<PromptConfig> & Partial<UpsertPromptConfigDto>,
    dto: PreviewRequestDto,
  ): Promise<PreviewResult> {
    const provider = this.aiFactory.getPersonalizationProvider();

    const serviceOffering = effective?.coreOffer ?? 'our service';
    const uniqueValue = effective?.mainOutcomePromised ?? 'achieve your goals';

    const positioningContext = effective
      ? {
          companyDescription: effective.companyDescription ?? undefined,
          coreOffer: effective.coreOffer ?? undefined,
          targetPersona: effective.targetPersona ?? undefined,
          mainPainSolved: effective.mainPainSolved ?? undefined,
          mainOutcomePromised: effective.mainOutcomePromised ?? undefined,
          proofPoints: (effective.proofPoints as string[] | undefined) ?? undefined,
        }
      : undefined;

    const personalizationSystemPrompt = this.buildEffectivePersonalizationSystemPrompt(
      effective as PromptConfig | null,
    );

    const personalizationPrompt = buildPersonalizationPrompt(
      {
        name: dto.sampleLeadName,
        role: dto.sampleLeadRole,
        company: dto.sampleLeadCompany,
        originalContent: dto.sampleContent,
        painPoints: dto.samplePainPoints ?? [],
        intentReasoning: 'Sample lead for preview',
      },
      serviceOffering,
      uniqueValue,
      positioningContext,
    );

    const personalizationResult = await provider.complete(personalizationPrompt, {
      systemPrompt: personalizationSystemPrompt,
      temperature: 0.4,
      maxTokens: 1024,
    });

    let parsed: {
      personalContext?: {
        openingHook?: string;
        painPointReference?: string;
        valueProposition?: string;
        callToAction?: string;
        toneNotes?: string;
      };
      toneProfile?: string;
      recommendedChannel?: string;
    } = {};
    try {
      parsed = JSON.parse(personalizationResult.content);
    } catch {
      // Use defaults
    }

    const personalContext = parsed.personalContext ?? {};
    const channel = parsed.recommendedChannel ?? 'linkedin-dm';
    const toneProfile = parsed.toneProfile ?? 'professional-casual';

    const campaignContext = effective
      ? {
          customToneInstructions: effective.customToneInstructions ?? undefined,
          ctaStyle: effective.ctaStyle ?? 'reply_question',
          customCta: effective.customCta ?? undefined,
          forbiddenPhrases: (effective.forbiddenPhrases as string[] | undefined) ?? undefined,
          complianceNotes: effective.complianceNotes ?? undefined,
        }
      : undefined;

    const outreachSystemPrompt = this.buildEffectiveOutreachSystemPrompt(
      effective as PromptConfig | null,
    );

    const outreachPrompt = buildOutreachPrompt(
      {
        channel,
        recipientName: dto.sampleLeadName,
        recipientRole: dto.sampleLeadRole,
        openingHook: personalContext.openingHook ?? `I saw you're dealing with ${dto.samplePainPoints?.[0] ?? 'challenges'}`,
        painPointReference: personalContext.painPointReference ?? dto.samplePainPoints?.[0] ?? '',
        valueProposition: personalContext.valueProposition ?? uniqueValue,
        callToAction: personalContext.callToAction ?? 'Would a quick call make sense?',
        toneProfile,
        serviceOffering,
      },
      campaignContext,
    );

    const outreachResult = await provider.complete(outreachPrompt, {
      systemPrompt: outreachSystemPrompt,
      temperature: 0.6,
      maxTokens: 512,
    });

    const messageBody = outreachResult.content.trim();

    const antiPatternResult = await provider.complete(
      `Message to check:\n\n"${messageBody}"`,
      { systemPrompt: ANTI_PATTERN_SYSTEM_PROMPT, temperature: 0.1, maxTokens: 256 },
    );

    let spamCheck = { spamScore: 0, isApproved: true };
    try {
      spamCheck = JSON.parse(antiPatternResult.content);
    } catch {
      // Use defaults
    }

    return {
      personalization: {
        openingHook: personalContext.openingHook ?? '',
        painPointReference: personalContext.painPointReference ?? '',
        valueProposition: personalContext.valueProposition ?? '',
        callToAction: personalContext.callToAction ?? '',
        toneProfile,
        channel,
      },
      outreachMessage: messageBody,
      channel,
      spamScore: spamCheck.spamScore,
      isApproved: spamCheck.isApproved,
    };
  }

  private buildUpdateData(dto: UpsertPromptConfigDto): Partial<UpsertPromptConfigDto> {
    const data: Record<string, unknown> = {};
    const fields: (keyof UpsertPromptConfigDto)[] = [
      'companyDescription', 'coreOffer', 'targetPersona', 'mainPainSolved',
      'mainOutcomePromised', 'proofPoints', 'preferredTone', 'customToneInstructions',
      'ctaStyle', 'customCta', 'forbiddenPhrases', 'forbiddenClaims',
      'complianceNotes', 'personalizationPromptOverride', 'outreachPromptOverride',
    ];
    for (const field of fields) {
      if (dto[field] !== undefined) data[field] = dto[field];
    }
    return data as Partial<UpsertPromptConfigDto>;
  }

  private extractSnapshotData(config: PromptConfig): PromptConfigSnapshotData {
    return {
      name: config.name,
      description: config.description ?? undefined,
      status: config.status,
      companyDescription: config.companyDescription ?? undefined,
      coreOffer: config.coreOffer ?? undefined,
      targetPersona: config.targetPersona ?? undefined,
      mainPainSolved: config.mainPainSolved ?? undefined,
      mainOutcomePromised: config.mainOutcomePromised ?? undefined,
      proofPoints: (config.proofPoints as string[]) ?? undefined,
      preferredTone: config.preferredTone as UpsertPromptConfigDto['preferredTone'],
      customToneInstructions: config.customToneInstructions ?? undefined,
      ctaStyle: config.ctaStyle as UpsertPromptConfigDto['ctaStyle'],
      customCta: config.customCta ?? undefined,
      forbiddenPhrases: (config.forbiddenPhrases as string[]) ?? undefined,
      forbiddenClaims: (config.forbiddenClaims as string[]) ?? undefined,
      complianceNotes: config.complianceNotes ?? undefined,
      personalizationPromptOverride: config.personalizationPromptOverride ?? undefined,
      outreachPromptOverride: config.outreachPromptOverride ?? undefined,
    };
  }
}
