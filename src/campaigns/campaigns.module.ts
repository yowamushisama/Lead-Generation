import { Module } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { CampaignsController } from './campaigns.controller';
import { DatabaseModule } from '../database/database.module';
import { AdaptersModule } from '../adapters/adapters.module';
import { PipelineModule } from '../pipeline/pipeline.module';
import { AppConfigModule } from '../config/config.module';
import { CampaignRunnerService } from './campaign-runner.service';

@Module({
  imports: [DatabaseModule, AdaptersModule, PipelineModule, AppConfigModule],
  providers: [CampaignsService, CampaignRunnerService],
  controllers: [CampaignsController],
  exports: [CampaignsService, CampaignRunnerService],
})
export class CampaignsModule {}
