import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { GoogleMapsAdapter } from './google-maps.adapter';
import { LeadSource } from '../../common/enums/lead-source.enum';

// Mock @googlemaps/google-maps-services-js
jest.mock('@googlemaps/google-maps-services-js', () => ({
  Client: jest.fn().mockImplementation(() => ({
    textSearch: jest.fn().mockResolvedValue({
      status: 200,
      data: {
        results: [
          {
            place_id: 'place_001',
            name: 'Acme Plumbing',
            formatted_address: '123 Main St, Austin, TX',
            rating: 4.6,
            user_ratings_total: 210,
          },
          {
            place_id: 'place_002',
            name: 'Best Pipes Co',
            formatted_address: '456 Oak Ave, Austin, TX',
            rating: 3.9,
            user_ratings_total: 45,
          },
        ],
        next_page_token: undefined,
      },
    }),
  })),
}));

describe('GoogleMapsAdapter', () => {
  let adapter: GoogleMapsAdapter;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        GoogleMapsAdapter,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, def?: string) => {
              if (key === 'GOOGLE_MAPS_API_KEY') return 'test-api-key';
              return def;
            },
          },
        },
      ],
    }).compile();

    adapter = module.get(GoogleMapsAdapter);
  });

  it('has correct name and sourceType', () => {
    expect(adapter.name).toBe(LeadSource.GOOGLE_MAPS);
    expect(adapter.sourceType).toBe('discovery');
  });

  it('maps Places API results to RawLeadInput correctly', async () => {
    const results: any[] = [];
    const gen = adapter.collect({
      organizationId: 'org-1',
      locations: ['Austin, TX'],
      industries: ['plumbing'],
      maxResults: 10,
    });

    for await (const lead of gen) {
      results.push(lead);
    }

    expect(results).toHaveLength(2);

    const first = results[0];
    expect(first.source).toBe(LeadSource.GOOGLE_MAPS);
    expect(first.sourceType).toBe('discovery');
    expect(first.name).toBe('Acme Plumbing');
    expect(first.externalId).toBe('place_001');
    expect(first.location).toBe('123 Main St, Austin, TX');
    expect(first.metadata).toMatchObject({
      rating: 4.6,
      reviewCount: 210,
      placeId: 'place_001',
    });
  });

  it('yields no leads when locations/industries are empty', async () => {
    const results: any[] = [];
    const gen = adapter.collect({ organizationId: 'org-1' });
    for await (const lead of gen) {
      results.push(lead);
    }
    expect(results).toHaveLength(0);
  });

  it('respects maxResults limit', async () => {
    const results: any[] = [];
    const gen = adapter.collect({
      organizationId: 'org-1',
      locations: ['Austin, TX'],
      industries: ['plumbing'],
      maxResults: 1,
    });

    for await (const lead of gen) {
      results.push(lead);
    }

    expect(results).toHaveLength(1);
  });
});
