import { CampaignRunnerService } from './campaign-runner.service';

const campaignRow = {
  id: 'camp-1',
  isActive: true,
  status: 'ACTIVE',
  keywords: ['automation'],
  targetLocations: ['Austin'],
  targetIndustries: ['Dental'],
  settings: { targetSources: ['linkedin'] },
  maxLeadsPerRun: null,
  icpProfile: null,
};

const rawLead = {
  externalId: 'lead-ext-1',
  source: 'linkedin',
  sourceType: 'intent',
  name: 'Jane Doe',
  originalContent: 'Looking for automation help',
  metadata: {},
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
  const campaignRunLogRepo = {
    start: jest.fn().mockResolvedValue(undefined),
    finish: jest.fn().mockResolvedValue(undefined),
    markLockedOut: jest.fn().mockResolvedValue(undefined),
    markFailed: jest.fn().mockResolvedValue(undefined),
  };
  const gmapsScrapeRunLogRepo = {
    incrementIngestion: jest.fn().mockResolvedValue(undefined),
  };

  const service = new CampaignRunnerService(
    campaignRepository as any,
    adapterRegistry as any,
    orchestrator as any,
    leadIngestion as any,
    configService as any,
    appConfig as any,
    redis as any,
    campaignRunLogRepo as any,
    gmapsScrapeRunLogRepo as any,
  );

  return { service, adapter, campaignRepository, orchestrator, leadIngestion, redis, campaignRunLogRepo };
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

  it('writes a CampaignRunLog row on successful run', async () => {
    const { service, campaignRunLogRepo } = buildService();

    const result = await service.runCampaign(tenant as any, 'camp-1', 'manual');

    expect(campaignRunLogRepo.start).toHaveBeenCalledWith(expect.objectContaining({
      campaignId: 'camp-1',
      organizationId: 'org-1',
      trigger: 'manual',
    }));
    expect(campaignRunLogRepo.finish).toHaveBeenCalledWith(
      result.runId,
      expect.objectContaining({ status: 'COMPLETED', newLeadsSaved: 1 }),
    );
  });

  it('marks CampaignRunLog LOCKED_OUT and throws ConflictException when lock is held', async () => {
    const { service, redis, campaignRunLogRepo } = buildService();
    redis.setnx.mockResolvedValue(false);

    await expect(service.runCampaign(tenant as any, 'camp-1', 'manual')).rejects.toMatchObject({
      response: expect.objectContaining({ runId: expect.any(String) }),
    });
    expect(campaignRunLogRepo.markLockedOut).toHaveBeenCalled();
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
    expect(result.duplicatesAtIngestion).toBe(1);
    expect(result.enqueued).toBe(0);
    expect(orchestrator.enqueuePersistedLead).not.toHaveBeenCalled();
  });

  it('stops consuming after goalMaxLeads saved leads reached', async () => {
    // Adapter yields 20 candidates, goal is 2 → runner should stop at 2 saved
    const collect = async function* () {
      for (let i = 0; i < 20; i++) {
        yield { ...rawLead, externalId: `lead-${i}`, name: `Lead ${i}`, metadata: {} };
      }
    };
    const ingestRawLead = jest.fn().mockImplementation(() =>
      Promise.resolve({ lead: { id: `lead-${ingestRawLead.mock.calls.length}` }, created: true }),
    );
    const configService = {
      get: jest.fn().mockImplementation((key: string, fallback?: string) => {
        if (key === 'CAMPAIGN_RUN_GOAL_MAX_LEADS') return '2';
        return fallback;
      }),
    };
    const orchestrator = { enqueuePersistedLead: jest.fn().mockResolvedValue('job-1') };
    const campaignRunLogRepo = {
      start: jest.fn().mockResolvedValue(undefined),
      finish: jest.fn().mockResolvedValue(undefined),
      markLockedOut: jest.fn().mockResolvedValue(undefined),
      markFailed: jest.fn().mockResolvedValue(undefined),
    };
    const gmapsScrapeRunLogRepo = { incrementIngestion: jest.fn().mockResolvedValue(undefined) };
    const campaignRepository = { findFirst: jest.fn().mockResolvedValue(campaignRow) };
    const adapterRegistry = {
      has: jest.fn().mockReturnValue(true),
      get: jest.fn().mockReturnValue({ name: 'linkedin', sourceType: 'intent', isHealthy: jest.fn().mockResolvedValue(true), collect }),
      getAll: jest.fn().mockReturnValue([]),
    };
    const redis = { setnx: jest.fn().mockResolvedValue(true), delIfOwner: jest.fn().mockResolvedValue(undefined) };

    const service = new CampaignRunnerService(
      campaignRepository as any,
      adapterRegistry as any,
      orchestrator as any,
      { ingestRawLead } as any,
      configService as any,
      { tenantMode: 'single' } as any,
      redis as any,
      campaignRunLogRepo as any,
      gmapsScrapeRunLogRepo as any,
    );

    const result = await service.runCampaign(tenant as any, 'camp-1', 'manual');

    expect(result.saved).toBe(2);
    expect(result.reachedGoal).toBe(true);
    expect(result.endReason).toBe('GOAL_REACHED');
    // candidatesYielded = saved + duplicatesAtIngestion + errors must hold
    expect(result.candidatesYielded).toBe(result.saved + result.duplicatesAtIngestion + result.errors);
    // Adapter yielded more than 2 but runner stopped at 2
    expect(ingestRawLead).toHaveBeenCalledTimes(2);
  });

  it('releases the Redis lock even when the adapter throws', async () => {
    const collect = async function* () {
      yield rawLead;
      throw new Error('scrape failed');
    };
    const { service, redis, campaignRunLogRepo } = buildService({ collect });

    await expect(service.runCampaign(tenant as any, 'camp-1', 'manual')).rejects.toThrow('scrape failed');

    expect(redis.delIfOwner).toHaveBeenCalled();
    expect(campaignRunLogRepo.markFailed).toHaveBeenCalled();
  });
});
