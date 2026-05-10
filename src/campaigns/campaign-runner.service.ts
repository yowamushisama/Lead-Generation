import { Injectable, Logger, ConflictException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { AdapterRegistryService } from '../adapters/adapter-registry.service';
import { AppConfigService } from '../config/config.service';
import { LeadSource } from '../common/enums/lead-source.enum';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { RawLeadInput } from '../common/interfaces/lead-input.interface';
import { CampaignRepository } from '../database/repositories/campaign.repository';
import { OrchestratorService } from '../pipeline/orchestrator.service';
import { LeadIngestionService } from '../pipeline/lead-ingestion.service';
import { RedisService } from '../database/redis.service';
import { ICPConfig } from '../common/types/icp.types';
import { CampaignRunLogRepository } from '../database/repositories/campaign-run-log.repository';
import { GmapsScrapeRunLogRepository } from '../database/repositories/gmaps-scrape-run-log.repository';
import { GmapsRunStatsCollectorImpl } from '../adapters/google-maps/gmaps-run-stats.collector';
import { CancellationSignal } from '../adapters/google-maps/gmaps-adapter.config';

export type CampaignRunTrigger = 'activation' | 'scheduled' | 'manual';

export interface CampaignRunSummary {
  runId: string;
  campaignId: string;
  trigger: CampaignRunTrigger;
  goalMaxLeads: number;
  reachedGoal: boolean;
  endReason: string;
  adaptersAttempted: string[];
  adaptersUsed: string[];
  skippedAdapters: Array<{ adapter: string; reason: string }>;
  saved: number;
  duplicates: number;
  duplicatesAtIngestion: number;
  duplicatesAtAdapter: number;
  candidatesYielded: number;
  enqueued: number;
  errors: number;
}

/** Campaign-wide saved-lead goal safety multiplier: max candidates = goal × this. */
const SAFETY_MULTIPLIER = 5;
const MAX_RUN_DURATION_MS = 4 * 60 * 60_000; // 4 hours — each query can now take up to 43 min
const MAX_RUN_ERRORS = 25;

@Injectable()
export class CampaignRunnerService {
  private readonly logger = new Logger(CampaignRunnerService.name);
  private readonly autonomousUnsupportedSources = new Set<string>([
    LeadSource.CSV_IMPORT,
    LeadSource.WEBHOOK,
  ]);

  private static readonly RUN_LOCK_TTL_SECONDS = 600;

  constructor(
    private readonly campaignRepository: CampaignRepository,
    private readonly adapterRegistry: AdapterRegistryService,
    private readonly orchestrator: OrchestratorService,
    private readonly leadIngestion: LeadIngestionService,
    private readonly configService: ConfigService,
    private readonly appConfig: AppConfigService,
    private readonly redis: RedisService,
    private readonly campaignRunLogRepo: CampaignRunLogRepository,
    private readonly gmapsScrapeRunLogRepo: GmapsScrapeRunLogRepository,
  ) {}

  async runOnActivationIfEnabled(tenant: TenantContext, campaignId: string): Promise<void> {
    if (!this.isEnabled('CAMPAIGN_RUN_ON_ACTIVATE')) {
      return;
    }

    try {
      await this.runCampaign(tenant, campaignId, 'activation');
    } catch (error) {
      this.logger.error({
        message: 'Immediate campaign run failed after activation',
        campaignId,
        organizationId: tenant.organizationId,
        error: String(error),
      });

      if (this.isEnabled('CAMPAIGN_RUN_FAIL_ON_ERROR')) {
        throw error;
      }
    }
  }

  async runCampaign(
    tenant: TenantContext,
    campaignId: string,
    trigger: CampaignRunTrigger,
  ): Promise<CampaignRunSummary> {
    const runId = randomUUID();

    // Load campaign before acquiring the lock so 404 stays clean even when locked,
    // and so LOCKED_OUT log rows include the correct goalMaxLeads.
    const campaign = await this.campaignRepository.findFirst({
      where: { id: campaignId, organizationId: tenant.organizationId },
      select: {
        id: true,
        isActive: true,
        status: true,
        keywords: true,
        targetLocations: true,
        targetIndustries: true,
        settings: true,
        maxLeadsPerRun: true,
        icpProfile: {
          select: {
            config: true,
            targetLocations: true,
            targetIndustries: true,
          },
        },
      },
    });

    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found`);
    }

    if (!campaign.isActive || campaign.status !== 'ACTIVE') {
      throw new Error(`Campaign ${campaignId} is not active`);
    }

    const goalMaxLeads = this.resolveGoal(campaign);

    const lockKey = `campaign:run:lock:${campaignId}`;
    const lockToken = randomUUID();
    const acquired = await this.redis.setnx(lockKey, lockToken, CampaignRunnerService.RUN_LOCK_TTL_SECONDS);
    if (!acquired) {
      await this.campaignRunLogRepo.markLockedOut({
        runId,
        campaignId,
        organizationId: tenant.organizationId,
        trigger,
        goalMaxLeads,
      }).catch(() => {});
      throw new ConflictException({
        message: `Campaign ${campaignId} is already running. Try again once the current run finishes.`,
        runId,
      });
    }

    try {
      return await this.runCampaignLocked(runId, tenant, campaign, goalMaxLeads, trigger);
    } finally {
      await this.redis.delIfOwner(lockKey, lockToken).catch(() => undefined);
    }
  }

  private async runCampaignLocked(
    runId: string,
    tenant: TenantContext,
    campaign: Record<string, unknown>,
    goalMaxLeads: number,
    trigger: CampaignRunTrigger,
  ): Promise<CampaignRunSummary> {
    const campaignId = campaign.id as string;
    const { organizationId } = tenant;
    const startedAt = Date.now();

    const maxCandidatesPerRun = goalMaxLeads > 0 ? goalMaxLeads * SAFETY_MULTIPLIER : 0;
    const maxRunDurationMs = this.readIntEnv('CAMPAIGN_RUN_MAX_DURATION_MS') ?? MAX_RUN_DURATION_MS;
    const maxRunErrors = this.readIntEnv('CAMPAIGN_RUN_MAX_ERRORS') ?? MAX_RUN_ERRORS;

    const settings = (campaign.settings as Record<string, unknown> | null) ?? {};
    const targetSources = this.readStringArray(settings['targetSources']);
    const requestedSources = this.resolveRequestedSources(targetSources);
    const keywords = ((campaign.keywords as string[] | null) ?? []).filter(Boolean);
    const campaignLocations = ((campaign.targetLocations as string[] | null) ?? []).filter(Boolean);
    const campaignIndustries = ((campaign.targetIndustries as string[] | null) ?? []).filter(Boolean);
    const icpConfig = ((campaign as any).icpProfile?.config as ICPConfig | null) ?? {} as ICPConfig;
    const icpLocations = (
      (((campaign as any).icpProfile?.targetLocations as string[] | null) ?? []).filter(Boolean).length > 0
        ? ((campaign as any).icpProfile?.targetLocations as string[])
        : (icpConfig.targetLocations ?? [])
    ).filter(Boolean);
    const icpIndustries = (
      (((campaign as any).icpProfile?.targetIndustries as string[] | null) ?? []).filter(Boolean).length > 0
        ? ((campaign as any).icpProfile?.targetIndustries as string[])
        : (icpConfig.targetIndustries ?? [])
    ).filter(Boolean);
    const locations = campaignLocations.length > 0 ? campaignLocations : icpLocations;
    const industries = campaignIndustries.length > 0 ? campaignIndustries : icpIndustries;

    const summary: CampaignRunSummary = {
      runId,
      campaignId,
      trigger,
      goalMaxLeads,
      reachedGoal: false,
      endReason: 'ADAPTERS_EXHAUSTED',
      adaptersAttempted: requestedSources,
      adaptersUsed: [],
      skippedAdapters: [],
      saved: 0,
      duplicates: 0,
      duplicatesAtIngestion: 0,
      duplicatesAtAdapter: 0,
      candidatesYielded: 0,
      enqueued: 0,
      errors: 0,
    };

    await this.campaignRunLogRepo.start({
      runId,
      campaignId,
      organizationId,
      trigger,
      goalMaxLeads,
      adaptersAttempted: requestedSources,
    }).catch(() => {});

    this.logger.log({
      message: 'Campaign run started',
      runId,
      campaignId,
      trigger,
      organizationId,
      goalMaxLeads,
      maxCandidatesPerRun: maxCandidatesPerRun || 'unlimited',
      requestedSources,
      keywordsCount: keywords.length,
      locationsCount: locations.length,
      industriesCount: industries.length,
    });

    try {
      const statsCollector = new GmapsRunStatsCollectorImpl(runId, this.gmapsScrapeRunLogRepo);
      const cancellationSignal: CancellationSignal = { reason: null };

      const toEnqueue: Array<{ leadId: string; rawInput: RawLeadInput }> = [];

      adapterLoop:
      for (const source of requestedSources) {
        if (!this.adapterRegistry.has(source)) {
          summary.skippedAdapters.push({ adapter: source, reason: 'not_registered' });
          continue;
        }

        const adapter = this.adapterRegistry.get(source);

        if (this.autonomousUnsupportedSources.has(adapter.name)) {
          summary.skippedAdapters.push({ adapter: adapter.name, reason: 'manual_input_required' });
          continue;
        }

        const healthy = await adapter.isHealthy().catch(() => false);
        if (!healthy) {
          summary.skippedAdapters.push({ adapter: adapter.name, reason: 'unhealthy' });
          continue;
        }

        if (adapter.sourceType === 'intent' && keywords.length === 0) {
          summary.skippedAdapters.push({ adapter: adapter.name, reason: 'missing_keywords' });
          continue;
        }

        if (adapter.sourceType === 'discovery' && (locations.length === 0 || industries.length === 0)) {
          summary.skippedAdapters.push({ adapter: adapter.name, reason: 'missing_locations_or_industries' });
          continue;
        }

        summary.adaptersUsed.push(adapter.name);

        const isGmaps = adapter.name === LeadSource.GOOGLE_MAPS;

        const adapterConfig: Record<string, unknown> = {
          organizationId,
          campaignId,
          keywords,
          locations,
          industries,
          ignoreExhausted: trigger === 'manual',
          ...(isGmaps ? {
            statsCollector,
            cancellationSignal,
            fastScrollEnabled: settings.gmapsFastScrollEnabled === true,
          } : {}),
        };

        // Phase 1: persist all scraped leads before enqueuing any.
        for await (const lead of adapter.collect(adapterConfig as any)) {
          summary.candidatesYielded++;
          try {
            const ingestion = await this.leadIngestion.ingestRawLead(lead, tenant, { campaignId });

            if (!ingestion.created) {
              summary.duplicates++;
              summary.duplicatesAtIngestion++;

              if (isGmaps && (lead.metadata as any)?.gmapsLogId) {
                await this.gmapsScrapeRunLogRepo
                  .incrementIngestion((lead.metadata as any).gmapsLogId, { ingestionDuplicates: 1 })
                  .catch(() => {});
              }
            } else {
              summary.saved++;
              toEnqueue.push({ leadId: ingestion.lead.id, rawInput: lead });

              if (isGmaps && (lead.metadata as any)?.gmapsLogId) {
                await this.gmapsScrapeRunLogRepo
                  .incrementIngestion((lead.metadata as any).gmapsLogId, { newLeadsSaved: 1 })
                  .catch(() => {});
              }
            }
          } catch (error) {
            summary.errors++;
            this.logger.error({
              message: 'Campaign lead persist failed',
              campaignId,
              organizationId,
              adapter: adapter.name,
              trigger,
              leadName: lead.name,
              sourceUrl: lead.sourceUrl,
              error: error instanceof Error ? error.message : String(error),
            });
          }

          // Safety checks happen AFTER processing the current candidate so the
          // reconciliation invariant (candidatesYielded = duplicates + saved + errors) always holds.
          if (goalMaxLeads > 0 && summary.saved >= goalMaxLeads) {
            cancellationSignal.reason = 'RUN_GOAL_REACHED';
            summary.reachedGoal = true;
            summary.endReason = 'GOAL_REACHED';
            break adapterLoop;
          }
          if (maxCandidatesPerRun > 0 && summary.candidatesYielded >= maxCandidatesPerRun) {
            cancellationSignal.reason = 'RUN_SAFETY_LIMIT';
            summary.endReason = 'SAFETY_LIMIT';
            break adapterLoop;
          }
          if (Date.now() - startedAt > maxRunDurationMs) {
            cancellationSignal.reason = 'RUN_SAFETY_LIMIT';
            summary.endReason = 'SAFETY_LIMIT';
            break adapterLoop;
          }
          if (summary.errors >= maxRunErrors) {
            cancellationSignal.reason = 'RUN_SAFETY_LIMIT';
            summary.endReason = 'SAFETY_LIMIT';
            break adapterLoop;
          }
        }

        if (summary.reachedGoal || summary.endReason === 'SAFETY_LIMIT') {
          break;
        }
      }

      summary.duplicatesAtAdapter = statsCollector.getTotalDuplicatesAtAdapter();

      this.logger.log({
        message: 'Campaign scrape complete — starting pipeline enqueue',
        runId,
        campaignId,
        organizationId,
        saved: summary.saved,
        duplicatesAtIngestion: summary.duplicatesAtIngestion,
        duplicatesAtAdapter: summary.duplicatesAtAdapter,
        candidatesYielded: summary.candidatesYielded,
        reachedGoal: summary.reachedGoal,
        endReason: summary.endReason,
      });

      // Phase 2: enqueue all newly saved leads for pipeline processing.
      for (const { leadId, rawInput } of toEnqueue) {
        try {
          await this.orchestrator.enqueuePersistedLead(leadId, rawInput, tenant, { campaignId });
          summary.enqueued++;
        } catch (error) {
          summary.errors++;
          this.logger.error({
            message: 'Campaign lead enqueue failed',
            campaignId,
            organizationId,
            trigger,
            leadId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      await this.campaignRunLogRepo.finish(runId, {
        completedAt: new Date(),
        durationMs: Date.now() - startedAt,
        status: 'COMPLETED',
        reachedGoal: summary.reachedGoal,
        endReason: summary.endReason,
        adaptersUsed: summary.adaptersUsed,
        adaptersSkipped: summary.skippedAdapters,
        candidatesYielded: summary.candidatesYielded,
        duplicatesAtAdapter: summary.duplicatesAtAdapter,
        duplicatesAtIngestion: summary.duplicatesAtIngestion,
        newLeadsSaved: summary.saved,
        enqueuedToPipeline: summary.enqueued,
        errors: summary.errors,
      }).catch(() => {});

    } catch (err: unknown) {
      await this.campaignRunLogRepo.markFailed(runId, err).catch(() => {});
      throw err;
    }

    this.logger.log({
      message: 'Campaign run completed',
      runId,
      campaignId,
      trigger,
      organizationId,
      saved: summary.saved,
      duplicatesAtIngestion: summary.duplicatesAtIngestion,
      duplicatesAtAdapter: summary.duplicatesAtAdapter,
      candidatesYielded: summary.candidatesYielded,
      enqueued: summary.enqueued,
      errors: summary.errors,
      reachedGoal: summary.reachedGoal,
      endReason: summary.endReason,
      adaptersUsed: summary.adaptersUsed,
      skippedAdapters: summary.skippedAdapters,
    });

    return summary;
  }

  buildSystemTenant(organizationId: string): TenantContext {
    return {
      organizationId,
      userId: 'system',
      mode: this.appConfig.tenantMode,
    };
  }

  private resolveGoal(campaign: Record<string, unknown>): number {
    const campaignCap = campaign.maxLeadsPerRun as number | null | undefined;
    if (campaignCap && campaignCap > 0) return campaignCap;

    const newEnv = this.readIntEnv('CAMPAIGN_RUN_GOAL_MAX_LEADS');
    if (newEnv) return newEnv;

    const legacyEnv = this.readIntEnv('CAMPAIGN_RUN_MAX_RESULTS_PER_ADAPTER');
    if (legacyEnv) {
      this.logger.warn(
        'CAMPAIGN_RUN_MAX_RESULTS_PER_ADAPTER is deprecated. Rename to CAMPAIGN_RUN_GOAL_MAX_LEADS. ' +
        'This env var now sets a campaign-wide saved-lead goal, not a per-adapter candidate cap.',
      );
      return legacyEnv;
    }

    return 100; // default
  }

  private resolveRequestedSources(targetSources: string[]): string[] {
    const sources =
      targetSources.length > 0
        ? targetSources
        : (() => {
            const override = this.readCsvEnv('CAMPAIGN_RUN_SOURCES');
            if (override.length > 0) return override;
            return this.adapterRegistry
              .getAll()
              .map((adapter) => adapter.name)
              .filter((name) => !this.autonomousUnsupportedSources.has(name));
          })();

    return sources;
  }

  private readCsvEnv(key: string): string[] {
    const value = this.configService.get<string>(key);
    if (!value) return [];
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private readStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  }

  private readIntEnv(key: string): number | undefined {
    const value = this.configService.get<string>(key);
    if (!value) return undefined;
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
  }

  private isEnabled(key: string): boolean {
    return this.configService.get<string>(key, 'false') === 'true';
  }
}
