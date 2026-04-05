import { Module } from '@nestjs/common';
import { AdapterRegistryService } from './adapter-registry.service';
import { CsvAdapter } from './csv/csv.adapter';
import { WebhookAdapter } from './webhook/webhook.adapter';

@Module({
  providers: [
    AdapterRegistryService,
    CsvAdapter,
    WebhookAdapter,
  ],
  exports: [AdapterRegistryService],
})
export class AdaptersModule {}
