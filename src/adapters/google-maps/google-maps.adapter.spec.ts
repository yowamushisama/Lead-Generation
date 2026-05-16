import { Test } from '@nestjs/testing';
import { GoogleMapsAdapter } from './google-maps.adapter';
import { GmapsSearchService } from './gmaps-search.service';
import { GmapsExtractionService } from './gmaps-extraction.service';
import { LeadSource } from '../../common/enums/lead-source.enum';
import type { GmapsPlace } from './gmaps-extraction.types';
import { LeadRepository } from '../../database/repositories/lead.repository';
import { CampaignScrapeCursorRepository } from '../../database/repositories/campaign-scrape-cursor.repository';

// URLs that include the !19sChIJ... pattern so placeIdFromUrl can extract a real placeId
const TEST_URL_1 = 'https://www.google.com/maps/place/Acme+Plumbing/data=!19sChIJtest1234';
const TEST_URL_2 = 'https://www.google.com/maps/place/Best+Pipes/data=!19sChIJtest5678';

const mockPlace = (overrides: Partial<GmapsPlace> = {}): GmapsPlace => ({
  placeId: 'ChIJtest1234',
  name: 'Acme Plumbing',
  rating: 4.6,
  reviewCount: 210,
  category: 'Plumber',
  googleTypes: ['Plumber'],
  address: '123 Main St, Austin, TX',
  phone: '+15125550001',
  website: 'https://acmeplumbing.example.com',
  yearsInBusiness: null,
  businessHours: { monday: '8 AM–5 PM' },
  lastReviewAt: '2026-04-01T00:00:00.000Z',
  socialHandles: {},
  sourceUrl: 'https://www.google.com/maps/place/Acme+Plumbing/data=test',
  ...overrides,
});

/** Build a scrollUntilStable mock that fires onBatch once with the given URLs then returns END_OF_FEED. */
function makeScrollMock(urls = [TEST_URL_1, TEST_URL_2]) {
  return jest.fn().mockImplementation(
    async (
      _page: unknown,
      opts: {
        onBatch: (u: string[]) => Promise<{ stop: boolean; reason?: string }>;
        onScrollStep?: () => void;
      },
    ) => {
      opts.onScrollStep?.();
      await opts.onBatch(urls);
      return 'END_OF_FEED';
    },
  );
}

describe('GoogleMapsAdapter', () => {
  let adapter: GoogleMapsAdapter;
  let searchService: jest.Mocked<GmapsSearchService>;
  let extractionService: jest.Mocked<GmapsExtractionService>;
  let leadRepository: jest.Mocked<Pick<LeadRepository, 'findMany'>>;
  let cursorRepository: jest.Mocked<Pick<CampaignScrapeCursorRepository, 'findActive' | 'findOne' | 'upsert' | 'appendSeen' | 'appendTail' | 'updateAnchor'>>;

  beforeEach(async () => {
    const mockPage = {
      waitForTimeout: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    };

    searchService = {
      newPage: jest.fn().mockResolvedValue(mockPage),
      buildSearchUrl: jest.fn().mockReturnValue('https://www.google.com/maps/search/plumber+in+Austin'),
      navigateToSearch: jest.fn().mockResolvedValue(undefined),
      scrollUntilStable: makeScrollMock(),
      fastScrollProbe: jest.fn().mockResolvedValue({
        mode: 'NORMAL',
        knownDuplicateKeys: new Set(),
        freshProbeListings: [],
        probeSeenCount: 0,
        hitRate: 0,
        reason: 'DISABLED',
        scrolls: 0,
      }),
      safeUrl: jest.fn().mockReturnValue('https://www.google.com/maps/search/...'),
    } as unknown as jest.Mocked<GmapsSearchService>;

    extractionService = {
      extractFromUrl: jest.fn()
        .mockResolvedValueOnce(mockPlace())
        .mockResolvedValueOnce(
          mockPlace({
            placeId: 'ChIJtest5678',
            name: 'Best Pipes Co',
            rating: 3.9,
            reviewCount: 45,
            address: '456 Oak Ave, Austin, TX',
            website: null,
            phone: null,
            socialHandles: {},
          }),
        ),
      extractDetailPage: jest.fn(),
      extractTiles: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<GmapsExtractionService>;

    leadRepository = {
      findMany: jest.fn().mockResolvedValue([]),
    };

    cursorRepository = {
      findActive: jest.fn().mockResolvedValue(null),
      findOne: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue({}),
      appendSeen: jest.fn().mockResolvedValue(undefined),
      appendTail: jest.fn().mockResolvedValue(undefined),
      updateAnchor: jest.fn().mockResolvedValue(undefined),
    };

    const module = await Test.createTestingModule({
      providers: [
        GoogleMapsAdapter,
        { provide: GmapsSearchService, useValue: searchService },
        { provide: GmapsExtractionService, useValue: extractionService },
        { provide: LeadRepository, useValue: leadRepository },
        { provide: CampaignScrapeCursorRepository, useValue: cursorRepository },
      ],
    }).compile();

    adapter = module.get(GoogleMapsAdapter);
  });

  it('has correct name and sourceType', () => {
    expect(adapter.name).toBe(LeadSource.GOOGLE_MAPS);
    expect(adapter.sourceType).toBe('discovery');
  });

  it('yields no leads when locations or industries are empty', async () => {
    const results: unknown[] = [];
    for await (const lead of adapter.collect({ organizationId: 'org-1' })) {
      results.push(lead);
    }
    expect(results).toHaveLength(0);
  });

  it('maps scraped places to RawLeadInput correctly', async () => {
    const results: RawLeadInput[] = [];
    for await (const lead of adapter.collect({
      organizationId: 'org-1',
      industries: ['plumber'],
      locations: ['Austin TX'],
    })) {
      results.push(lead as RawLeadInput);
    }

    expect(results).toHaveLength(2);

    const first = results[0];
    expect(first.source).toBe(LeadSource.GOOGLE_MAPS);
    expect(first.sourceType).toBe('discovery');
    expect(first.name).toBe('Acme Plumbing');
    expect(first.externalId).toBe('ChIJtest1234');
    expect(first.location).toBe('123 Main St, Austin, TX');
    expect(first.website).toBe('https://acmeplumbing.example.com');
    expect(first.phone).toBe('+15125550001');
    expect(first.metadata).toMatchObject({
      rating: 4.6,
      reviewCount: 210,
      placeId: 'ChIJtest1234',
      googleTypes: ['Plumber'],
    });
  });

  it('caps extraction at maxExtractionsPerQuery', async () => {
    const results: unknown[] = [];
    for await (const lead of adapter.collect({
      organizationId: 'org-1',
      industries: ['plumber'],
      locations: ['Austin TX'],
      maxExtractionsPerQuery: 1,
    })) {
      results.push(lead);
    }
    expect(results).toHaveLength(1);
  });

  it('applies rating and review filters in tile mode without forcing detail extraction', async () => {
    extractionService.extractTiles.mockResolvedValue([
      { name: 'Good Shop', rating: 4.8, reviewCount: 80, category: 'Plumber', website: null, url: TEST_URL_1 },
      { name: 'Low Rated Shop', rating: 3.2, reviewCount: 100, category: 'Plumber', website: null, url: TEST_URL_2 },
    ]);

    const results: RawLeadInput[] = [];
    for await (const lead of adapter.collect({
      organizationId: 'org-1',
      industries: ['plumber'],
      locations: ['Austin TX'],
      fetchDetails: false,
      gmapsFilters: { minRating: 4, minReviewCount: 10 },
    } as any)) {
      results.push(lead as RawLeadInput);
    }

    expect(extractionService.extractFromUrl).not.toHaveBeenCalled();
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Good Shop');
  });

  it('filters website-button listings in tile mode for no-website ICP filters', async () => {
    extractionService.extractTiles.mockResolvedValue([
      { name: 'Has Site', rating: 4.8, reviewCount: 80, category: 'Plumber', website: 'https://hassite.example.com', url: TEST_URL_1 },
      { name: 'No Site', rating: 4.2, reviewCount: 30, category: 'Plumber', website: null, url: TEST_URL_2 },
    ]);

    const results: RawLeadInput[] = [];
    for await (const lead of adapter.collect({
      organizationId: 'org-1',
      industries: ['plumber'],
      locations: ['Austin TX'],
      fetchDetails: false,
      gmapsFilters: { websitePresence: 'none' },
    } as any)) {
      results.push(lead as RawLeadInput);
    }

    expect(extractionService.extractFromUrl).not.toHaveBeenCalled();
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('No Site');
  });

  it('prefilters website-button listings before detail extraction for no-website ICP filters', async () => {
    const statsCollector = {
      beginQuery: jest.fn().mockResolvedValue('gmaps-log-1'),
      recordCandidateUrlsCollected: jest.fn(),
      recordCandidateExtracted: jest.fn(),
      recordFilteredOut: jest.fn(),
      finishQuery: jest.fn().mockResolvedValue(undefined),
    };

    searchService.scrollUntilStable.mockImplementationOnce(async (_page, opts: any) => {
      await opts.onBatch(
        [TEST_URL_1, TEST_URL_2],
        [
          { name: 'Has Site', url: TEST_URL_1, website: 'https://hassite.example.com', hasWebsite: true },
          { name: 'No Site', url: TEST_URL_2, website: null, hasWebsite: false },
        ],
      );
      return 'END_OF_FEED';
    });
    extractionService.extractFromUrl.mockReset();
    extractionService.extractFromUrl.mockImplementation(async (_page, url) =>
      mockPlace({
        placeId: 'ChIJtest5678',
        name: 'No Site',
        website: null,
        sourceUrl: url,
      }),
    );

    const results: RawLeadInput[] = [];
    for await (const lead of adapter.collect({
      organizationId: 'org-1',
      campaignId: 'campaign-1',
      industries: ['plumber'],
      locations: ['Austin TX'],
      gmapsFilters: { websitePresence: 'none' },
      statsCollector,
    } as any)) {
      results.push(lead as RawLeadInput);
    }

    expect(extractionService.extractFromUrl).toHaveBeenCalledTimes(1);
    expect(extractionService.extractFromUrl).toHaveBeenCalledWith(expect.anything(), TEST_URL_2);
    expect(cursorRepository.appendSeen).toHaveBeenCalledWith(
      'campaign-1',
      'google_maps',
      expect.any(String),
      expect.arrayContaining(['ChIJtest1234', 'ChIJtest5678']),
    );
    expect(statsCollector.recordFilteredOut).toHaveBeenCalledWith('gmaps-log-1', ['website']);
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('No Site');
  });

  it('falls back externalId to sourceUrl when placeId is null', async () => {
    extractionService.extractFromUrl.mockReset();
    extractionService.extractFromUrl.mockResolvedValue(mockPlace({ placeId: null }));

    const results: RawLeadInput[] = [];
    for await (const lead of adapter.collect({
      organizationId: 'org-1',
      industries: ['plumber'],
      locations: ['Austin TX'],
      maxExtractionsPerQuery: 1,
    })) {
      results.push(lead as RawLeadInput);
    }

    expect(results[0].externalId).toBe('https://www.google.com/maps/place/Acme+Plumbing/data=test');
  });

  it('skips places with no name', async () => {
    extractionService.extractFromUrl.mockReset();
    extractionService.extractFromUrl
      .mockResolvedValueOnce(mockPlace({ name: '' }))
      .mockResolvedValueOnce(mockPlace({ placeId: 'ChIJtest5678', name: 'Best Pipes Co' }));

    const results: unknown[] = [];
    for await (const lead of adapter.collect({
      organizationId: 'org-1',
      industries: ['plumber'],
      locations: ['Austin TX'],
    })) {
      results.push(lead);
    }

    expect(results).toHaveLength(1);
  });

  it('skips exhausted queries by default', async () => {
    // Normal flow uses findActive (excludes archived); exhausted=true triggers the skip.
    cursorRepository.findActive.mockResolvedValue({
      exhausted: true,
      consecutiveZeroRuns: 3,
      lastScrollSteps: 12,
      seenExternalIds: [],
      tailIds: [],
      duplicateWallHits: 0,
    } as any);

    const results: unknown[] = [];
    for await (const lead of adapter.collect({
      organizationId: 'org-1',
      campaignId: 'campaign-1',
      industries: ['plumber'],
      locations: ['Austin TX'],
    })) {
      results.push(lead);
    }

    expect(results).toHaveLength(0);
    expect(searchService.navigateToSearch).not.toHaveBeenCalled();
  });

  it('retries exhausted queries when ignoreExhausted is true', async () => {
    // ignoreExhausted=true uses findOne({includeArchived:true}) to surface archived cursors.
    cursorRepository.findOne.mockResolvedValue({
      exhausted: true,
      consecutiveZeroRuns: 3,
      lastScrollSteps: 12,
      seenExternalIds: [],
      tailIds: [],
      duplicateWallHits: 0,
    } as any);

    const results: unknown[] = [];
    for await (const lead of adapter.collect({
      organizationId: 'org-1',
      campaignId: 'campaign-1',
      industries: ['plumber'],
      locations: ['Austin TX'],
      ignoreExhausted: true,
    })) {
      results.push(lead);
    }

    expect(results).toHaveLength(2);
    expect(searchService.navigateToSearch).toHaveBeenCalled();
  });

  it('skips URLs already in cursor cache', async () => {
    // Seed cursor with the first URL's placeId — first URL should be skipped.
    // Normal flow goes through findActive (not findOne).
    cursorRepository.findActive.mockResolvedValue({
      exhausted: false,
      consecutiveZeroRuns: 0,
      lastScrollSteps: 8,
      seenExternalIds: ['ChIJtest1234'],
      tailIds: [],
      duplicateWallHits: 0,
    } as any);

    const results: unknown[] = [];
    for await (const lead of adapter.collect({
      organizationId: 'org-1',
      campaignId: 'campaign-1',
      industries: ['plumber'],
      locations: ['Austin TX'],
    })) {
      results.push(lead);
    }

    // First URL (ChIJtest1234) is in cursor cache → skipped; only second URL is extracted
    expect(results).toHaveLength(1);
  });

  it('skips URLs already in DB (batch DB dedup)', async () => {
    // DB already contains the second URL's place
    leadRepository.findMany.mockResolvedValue([
      { externalId: 'ChIJtest5678', placeId: 'ChIJtest5678' },
    ] as any);

    const results: RawLeadInput[] = [];
    for await (const lead of adapter.collect({
      organizationId: 'org-1',
      industries: ['plumber'],
      locations: ['Austin TX'],
    })) {
      results.push(lead as RawLeadInput);
    }

    // Second URL already in DB → skipped at collection phase; only first URL is extracted
    expect(results).toHaveLength(1);
    expect(results[0].externalId).toBe('ChIJtest1234');
  });
});

// Minimal local type alias so we can annotate results without importing from deep paths
type RawLeadInput = {
  source: string;
  sourceType: string;
  name: string;
  externalId: string | null;
  location?: string;
  website?: string | null;
  phone?: string | null;
  metadata?: Record<string, unknown>;
};
