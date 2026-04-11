import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@googlemaps/google-maps-services-js';
import { BaseAdapter } from '../base.adapter';
import { AdapterConfig } from '../../common/interfaces/adapter.interface';
import { RawLeadInput } from '../../common/interfaces/lead-input.interface';
import { LeadSource } from '../../common/enums/lead-source.enum';

// Delay required by Google between paginated requests using next_page_token
const PAGINATION_DELAY_MS = 2000;
// Delay between individual location×industry query combinations to avoid quota exhaustion
const INTER_QUERY_DELAY_MS = 200;

@Injectable()
export class GoogleMapsAdapter extends BaseAdapter {
  readonly name = LeadSource.GOOGLE_MAPS;
  readonly sourceType = 'discovery' as const;

  private readonly client: Client;
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    super();
    this.client = new Client({});
    this.apiKey = this.configService.get<string>('GOOGLE_MAPS_API_KEY', '');
  }

  async isHealthy(): Promise<boolean> {
    if (!this.apiKey) {
      this.logWarn('GOOGLE_MAPS_API_KEY is not configured');
      return false;
    }
    try {
      const response = await this.client.textSearch({
        params: { query: 'coffee shop', key: this.apiKey },
      });
      return response.status === 200 && Array.isArray(response.data.results);
    } catch {
      return false;
    }
  }

  async *collect(config: AdapterConfig): AsyncGenerator<RawLeadInput> {
    this.validateConfig(config);

    const locations = config.locations ?? [];
    const industries = config.industries ?? [];
    const maxResults = config.maxResults ?? 100;

    if (locations.length === 0 || industries.length === 0) {
      this.logWarn('Google Maps adapter requires both locations and industries in config', {
        organizationId: config.organizationId,
      });
      return;
    }

    if (!this.apiKey) {
      this.logError('GOOGLE_MAPS_API_KEY is missing — cannot collect');
      return;
    }

    let yielded = 0;

    for (const location of locations) {
      for (const industry of industries) {
        if (yielded >= maxResults) break;

        if (yielded > 0) {
          // Brief pause between query combinations to avoid exhausting quota
          await new Promise<void>((resolve) => setTimeout(resolve, INTER_QUERY_DELAY_MS));
        }

        const query = `${industry} in ${location}`;
        this.log(`Searching Google Maps: "${query}"`, { organizationId: config.organizationId });

        let pageToken: string | undefined;

        do {
          try {
            const response = await this.client.textSearch({
              params: {
                query,
                key: this.apiKey,
                ...(pageToken ? { pagetoken: pageToken } : {}),
              },
            });

            const results = response.data.results ?? [];
            pageToken = response.data.next_page_token ?? undefined;

            for (const place of results) {
              if (yielded >= maxResults) break;

              yield {
                externalId: place.place_id,
                source: LeadSource.GOOGLE_MAPS,
                sourceType: 'discovery',
                // NOTE: textSearch does not return website; a Place Details API call
                // per result is required to populate this field reliably.
                sourceUrl: (place as any).website ?? undefined,
                name: place.name ?? 'Unknown Business',
                company: place.name ?? undefined,
                location: place.formatted_address ?? undefined,
                phone: (place as any).formatted_phone_number ?? undefined,
                website: (place as any).website ?? undefined,
                industry,
                metadata: {
                  rating: place.rating,
                  reviewCount: place.user_ratings_total,
                  placeId: place.place_id,
                  campaignId: config.campaignId,
                  searchQuery: query,
                  scrapedAt: new Date().toISOString(),
                },
              };

              yielded++;
            }

            // Google requires a mandatory wait before using next_page_token
            if (pageToken && yielded < maxResults) {
              await new Promise<void>((resolve) => setTimeout(resolve, PAGINATION_DELAY_MS));
            }
          } catch (error) {
            this.logError(`Google Maps API error for query: "${query}"`, error);
            break;
          }
        } while (pageToken && yielded < maxResults);
      }
    }

    this.log(`Google Maps collect complete: ${yielded} leads`, {
      organizationId: config.organizationId,
    });
  }
}
