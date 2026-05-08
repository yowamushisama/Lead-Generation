import { Test } from '@nestjs/testing';
import { GoogleMapsAdapter } from './google-maps.adapter';
import { GmapsSearchService } from './gmaps-search.service';
import { GmapsExtractionService } from './gmaps-extraction.service';
import { LeadSource } from '../../common/enums/lead-source.enum';
import type { GmapsPlace } from './gmaps-extraction.types';
import { LeadRepository } from '../../database/repositories/lead.repository';
import { CampaignScrapeCursorRepository } from '../../database/repositories/campaign-scrape-cursor.repository';

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
  businessHours: { monday: '8 AM–5 PM' },
  lastReviewAt: '2026-04-01T00:00:00.000Z',
  socialHandles: {},
  sourceUrl: 'https://www.google.com/maps/place/Acme+Plumbing/data=test',
  ...overrides,
});

describe('GoogleMapsAdapter', () => {
  let adapter: GoogleMapsAdapter;
  let searchService: jest.Mocked<GmapsSearchService>;
  let extractionService: jest.Mocked<GmapsExtractionService>;

  beforeEach(async () => {
    const mockPage = {
      waitForTimeout: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
    };

    searchService = {
      newPage: jest.fn().mockResolvedValue(mockPage),
      buildSearchUrl: jest.fn().mockReturnValue('https://www.google.com/maps/search/plumber+in+Austin'),
      navigateToSearch: jest.fn().mockResolvedValue(undefined),
      scrollFeed: jest.fn().mockResolvedValue(undefined),
      collectListingUrls: jest.fn().mockResolvedValue([
        'https://www.google.com/maps/place/Acme+Plumbing/data=test1',
        'https://www.google.com/maps/place/Best+Pipes/data=test2',
      ]),
      safeUrl: jest.fn().mockReturnValue('https://www.google.com/maps/search/...'),
    } as unknown as jest.Mocked<GmapsSearchService>;

    extractionService = {
      extractFromUrl: jest.fn()
        .mockResolvedValueOnce(mockPlace())
        .mockResolvedValueOnce(mockPlace({
          placeId: 'ChIJtest5678',
          name: 'Best Pipes Co',
          rating: 3.9,
          reviewCount: 45,
          address: '456 Oak Ave, Austin, TX',
          website: null,
          phone: null,
          socialHandles: {},
        })),
      extractDetailPage: jest.fn(),
      extractTiles: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<GmapsExtractionService>;

    const leadRepository: jest.Mocked<Pick<LeadRepository, 'findMany'>> = {
      findMany: jest.fn().mockResolvedValue([]),
    };

    const cursorRepository: jest.Mocked<Pick<CampaignScrapeCursorRepository, 'findOne' | 'upsert'>> = {
      findOne: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue({}),
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
    const results: any[] = [];
    for await (const lead of adapter.collect({
      organizationId: 'org-1',
      industries: ['plumber'],
      locations: ['Austin TX'],
      maxResults: 10,
    })) {
      results.push(lead);
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

  it('respects maxResults limit', async () => {
    const results: unknown[] = [];
    for await (const lead of adapter.collect({
      organizationId: 'org-1',
      industries: ['plumber'],
      locations: ['Austin TX'],
      maxResults: 1,
    })) {
      results.push(lead);
    }
    expect(results).toHaveLength(1);
  });

  it('falls back externalId to sourceUrl when placeId is null', async () => {
    extractionService.extractFromUrl.mockReset();
    extractionService.extractFromUrl.mockResolvedValue(mockPlace({ placeId: null }));

    const results: any[] = [];
    for await (const lead of adapter.collect({
      organizationId: 'org-1',
      industries: ['plumber'],
      locations: ['Austin TX'],
      maxResults: 1,
    })) {
      results.push(lead);
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
      maxResults: 10,
    })) {
      results.push(lead);
    }

    // first result skipped (empty name), second yielded
    expect(results).toHaveLength(1);
  });
});
