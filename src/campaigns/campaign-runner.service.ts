import { Injectable, Logger, ConflictException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { AdapterRegistryService } from '../adapters/adapter-registry.service';
import { AppConfigService } from '../config/config.service';
import { LeadSource } from '../common/enums/lead-source.enum';
import { TenantContext } from '../common/interfaces/tenant-context.interface';
import { CampaignRepository } from '../database/repositories/campaign.repository';
import { OrchestratorService } from '../pipeline/orchestrator.service';
import { RedisService } from '../database/redis.service';

export type CampaignRunTrigger = 'activation' | 'scheduled' | 'manual';

export interface CampaignRunSummary {
  campaignId: string;
  trigger: CampaignRunTrigger;
  adaptersAttempted: string[];
  adaptersUsed: string[];
  skippedAdapters: Array<{ adapter: string; reason: string }>;
  enqueued: number;
}

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
    private readonly configService: ConfigService,
    private readonly appConfig: AppConfigService,
    private readonly redis: RedisService,
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
    const lockKey = `campaign:run:lock:${campaignId}`;
    const lockToken = randomUUID();
    const acquired = await this.redis.setnx(lockKey, lockToken, CampaignRunnerService.RUN_LOCK_TTL_SECONDS);
    if (!acquired) {
      throw new ConflictException(`Campaign ${campaignId} is already running. Try again once the current run finishes.`);
    }

    try {
      return await this.runCampaignLocked(tenant, campaignId, trigger);
    } finally {
      await this.redis.delIfOwner(lockKey, lockToken).catch(() => undefined);
    }
  }

  private async runCampaignLocked(
    tenant: TenantContext,
    campaignId: string,
    trigger: CampaignRunTrigger,
  ): Promise<CampaignRunSummary> {
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
      },
    });

    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found`);
    }

    if (!campaign.isActive || campaign.status !== 'ACTIVE') {
      throw new Error(`Campaign ${campaignId} is not active`);
    }

    const settings = (campaign.settings as Record<string, unknown> | null) ?? {};
    const targetSources = this.readStringArray(settings['targetSources']);
    const requestedSources = this.resolveRequestedSources(targetSources);
    const maxResults = this.readIntEnv('CAMPAIGN_RUN_MAX_RESULTS_PER_ADAPTER');
    const keywords = ((campaign.keywords as string[] | null) ?? []).filter(Boolean);
    const locations = ((campaign.targetLocations as string[] | null) ?? []).filter(Boolean);
    const industries = ((campaign.targetIndustries as string[] | null) ?? []).filter(Boolean);

    const summary: CampaignRunSummary = {
      campaignId,
      trigger,
      adaptersAttempted: requestedSources,
      adaptersUsed: [],
      skippedAdapters: [],
      enqueued: 0,
    };

    this.logger.log({
      message: 'Campaign run started',
      campaignId,
      trigger,
      organizationId: tenant.organizationId,
      mode: tenant.mode ?? this.appConfig.tenantMode,
      requestedSources,
      maxResultsPerAdapter: maxResults ?? 'default',
      keywordsCount: keywords.length,
      locationsCount: locations.length,
      industriesCount: industries.length,
    });

    for (const source of requestedSources) {
      if (!this.adapterRegistry.has(source)) {
        summary.skippedAdapters.push({ adapter: source, reason: 'not_registered' });
        this.logger.warn({
          message: 'Skipping campaign adapter that is not registered',
          campaignId,
          organizationId: tenant.organizationId,
          adapter: source,
        });
        continue;
      }

      const adapter = this.adapterRegistry.get(source);

      if (this.autonomousUnsupportedSources.has(adapter.name)) {
        summary.skippedAdapters.push({ adapter: adapter.name, reason: 'manual_input_required' });
        this.logger.warn({
          message: 'Skipping adapter during autonomous campaign run',
          campaignId,
          organizationId: tenant.organizationId,
          adapter: adapter.name,
          reason: 'manual_input_required',
        });
        continue;
      }

      const healthy = await adapter.isHealthy().catch(() => false);
      if (!healthy) {
        summary.skippedAdapters.push({ adapter: adapter.name, reason: 'unhealthy' });
        this.logger.warn({
          message: 'Skipping unhealthy adapter during campaign run',
          campaignId,
          organizationId: tenant.organizationId,
          adapter: adapter.name,
        });
        continue;
      }

      if (adapter.sourceType === 'intent' && keywords.length === 0) {
        summary.skippedAdapters.push({ adapter: adapter.name, reason: 'missing_keywords' });
        this.logger.warn({
          message: 'Skipping intent adapter for campaign without keywords',
          campaignId,
          organizationId: tenant.organizationId,
          adapter: adapter.name,
        });
        continue;
      }

      if (adapter.sourceType === 'discovery' && (locations.length === 0 || industries.length === 0)) {
        summary.skippedAdapters.push({ adapter: adapter.name, reason: 'missing_locations_or_industries' });
        this.logger.warn({
          message: 'Skipping discovery adapter for campaign without locations or industries',
          campaignId,
          organizationId: tenant.organizationId,
          adapter: adapter.name,
        });
        continue;
      }

      summary.adaptersUsed.push(adapter.name);

      const config = {
        organizationId: tenant.organizationId,
        campaignId,
        keywords,
        locations,
        industries,
        ...(maxResults ? { maxResults } : {}),
      };

      for await (const lead of adapter.collect(config)) {
        const jobId = await this.orchestrator.enqueueLead(lead, tenant, { campaignId });
        summary.enqueued++;

        if (this.isEnabled('CAMPAIGN_RUN_DEBUG')) {
          this.logger.log({
            message: 'Campaign lead enqueued',
            campaignId,
            organizationId: tenant.organizationId,
            adapter: adapter.name,
            trigger,
            jobId,
            leadName: lead.name,
            sourceUrl: lead.sourceUrl,
          });
        }
      }
    }

    this.logger.log({
      message: 'Campaign run completed',
      campaignId,
      trigger,
      organizationId: tenant.organizationId,
      enqueued: summary.enqueued,
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

  private resolveRequestedSources(targetSources: string[]): string[] {
    // Campaign-level targetSources always takes priority over the global env override.
    // CAMPAIGN_RUN_SOURCES is only a fallback used when no campaign sources are configured,
    // e.g. for debugging a specific adapter system-wide.
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
