import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppConfigService } from './config.service';
import aiConfig from './ai.config';
import scoringConfig from './scoring.config';
import scrapingConfig from './scraping.config';
import tenancyConfig from './tenancy.config';

@Module({
  imports: [
    ConfigModule.forFeature(aiConfig),
    ConfigModule.forFeature(scoringConfig),
    ConfigModule.forFeature(scrapingConfig),
    ConfigModule.forFeature(tenancyConfig),
  ],
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule {}
