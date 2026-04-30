import { Module } from '@nestjs/common';
import { AdapterRegistryService } from './adapter-registry.service';
import { CsvAdapter } from './csv/csv.adapter';
import { WebhookAdapter } from './webhook/webhook.adapter';
import { LinkedInAdapter } from './linkedin/linkedin.adapter';
import { LinkedInStealthService } from './linkedin/linkedin-stealth.service';
import { LinkedInSessionService } from './linkedin/linkedin-session.service';
import { LinkedInProxyService } from './linkedin/linkedin-proxy.service';
import { LinkedInDiagnosticsService } from './linkedin/linkedin-diagnostics.service';
import { LinkedInSearchService } from './linkedin/linkedin-search.service';
import { LinkedInExtractionService } from './linkedin/linkedin-extraction.service';
import { LinkedInRunSummaryService } from './linkedin/linkedin-run-summary.service';
import { GoogleMapsAdapter } from './google-maps/google-maps.adapter';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [
    AdapterRegistryService,
    CsvAdapter,
    WebhookAdapter,
    // LinkedIn scraping stack
    LinkedInStealthService,
    LinkedInProxyService,
    LinkedInSessionService,
    LinkedInDiagnosticsService,
    LinkedInSearchService,
    LinkedInExtractionService,
    LinkedInRunSummaryService,
    LinkedInAdapter,
    // Google Maps discovery
    GoogleMapsAdapter,
  ],
  exports: [AdapterRegistryService],
})
export class AdaptersModule {}
