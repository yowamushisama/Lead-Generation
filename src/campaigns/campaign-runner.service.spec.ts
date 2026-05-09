import { CampaignRunnerService } from './campaign-runner.service';

const campaignRow = {
  id: 'camp-1',
  isActive: true,
  status: 'ACTIVE',
  keywords: ['automation'],
  targetLocations: ['Austin'],
  targetIndustries: ['Dental'],
  settings: { targetSources: ['linkedin'] },
  icpProfile: null,
};

const rawLead = {
  externalId: 'lead-ext-1',
  source: 'linkedin',
  sourceType: 'intent',
  name: 'Jane Doe',
  originalContent: 'Looking for automation help',
};

function buildService(overrides: {
  collect?: () => AsyncGenerator<any>;
  ingestRawLead?: jest.Mock;
  enqueuePersistedLead?: jest.Mock;
} = {}) {
  const adapter = {
    name: 'linkedin',
    sourceType: 'intent',
    isHealthy: jest.fn().mockResolvedValue(true),
    collect: overrides.collect ?? (async function* () {
      yield rawLead;
    }),
  };

  const campaignRepository = {
    findFirst: jest.fn().mockResolvedValue(campaignRow),
  };
  const adapterRegistry = {
    has: jest.fn().mockReturnValue(true),
    get: jest.fn().mockReturnValue(adapter),
    getAll: jest.fn().mockReturnValue([adapter]),
  };
  const orchestrator = {
    enqueuePersistedLead: overrides.enqueuePersistedLead ?? jest.fn().mockResolvedValue('job-1'),
  };
  const leadIngestion = {
    ingestRawLead:
      overrides.ingestRawLead ??
      jest.fn().mockResolvedValue({
        lead: { id: 'lead-1' },
        created: true,
        duplicate: false,
      }),
  };
  const configService = {
    get: jest.fn().mockImplementation((_key: string, fallback?: string) => fallback),
  };
  const appConfig = { tenantMode: 'single' };
  const redis = {
    setnx: jest.fn().mockResolvedValue(true),
    delIfOwner: jest.fn().mockResolvedValue(undefined),
  };

  const service = new CampaignRunnerService(
    campaignRepository as any,
    adapterRegistry as any,
    orchestrator as any,
    leadIngestion as any,
    configService as any,
    appConfig as any,
    redis as any,
  );

  return { service, adapter, campaignRepository, orchestrator, leadIngestion, redis };
}

describe('CampaignRunnerService', () => {
  const tenant = { organizationId: 'org-1', userId: 'user-1', mode: 'single' };

  it('persists each scraped lead before enqueueing processing', async () => {
    const { service, orchestrator, leadIngestion } = buildService();

    const result = await service.runCampaign(tenant as any, 'camp-1', 'manual');

    expect(result.saved).toBe(1);
    expect(result.enqueued).toBe(1);
    expect(leadIngestion.ingestRawLead).toHaveBeenCalledWith(rawLead, tenant, { campaignId: 'camp-1' });
    expect(orchestrator.enqueuePersistedLead).toHaveBeenCalledWith('lead-1', rawLead, tenant, {
      campaignId: 'camp-1',
    });
    expect(leadIngestion.ingestRawLead.mock.invocationCallOrder[0]).toBeLessThan(
      orchestrator.enqueuePersistedLead.mock.invocationCallOrder[0],
    );
  });

  it('keeps already-yielded leads persisted when the adapter later throws', async () => {
    const collect = async function* () {
      yield rawLead;
      throw new Error('scrape failed');
    };
    const { service, leadIngestion, orchestrator, redis } = buildService({ collect });

    await expect(service.runCampaign(tenant as any, 'camp-1', 'manual')).rejects.toThrow('scrape failed');

    expect(leadIngestion.ingestRawLead).toHaveBeenCalledTimes(1);
    expect(orchestrator.enqueuePersistedLead).toHaveBeenCalledTimes(1);
    expect(redis.delIfOwner).toHaveBeenCalled();
  });

  it('does not enqueue duplicate scraped leads', async () => {
    const ingestRawLead = jest.fn().mockResolvedValue({
      lead: { id: 'lead-1' },
      created: false,
      duplicate: true,
    });
    const { service, orchestrator } = buildService({ ingestRawLead });

    const result = await service.runCampaign(tenant as any, 'camp-1', 'manual');

    expect(result.duplicates).toBe(1);
    expect(result.enqueued).toBe(0);
    expect(orchestrator.enqueuePersistedLead).not.toHaveBeenCalled();
  });
});
