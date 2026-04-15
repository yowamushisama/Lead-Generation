import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DailyScrapeJob } from './daily-scrape.job';
import { DataRetentionJob } from './data-retention.job';
import { AnalyticsRollupJob } from './analytics-rollup.job';
import { ICPRefinementJob } from './icp-refinement.job';
import { DatabaseModule } from '../database/database.module';
import { AdaptersModule } from '../adapters/adapters.module';
import { PipelineModule } from '../pipeline/pipeline.module';
import { ComplianceModule } from '../compliance/compliance.module';
import { ICPModule } from '../icp/icp.module';
import { CampaignsModule } from '../campaigns/campaigns.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    DatabaseModule,
    AdaptersModule,
    PipelineModule,
    ComplianceModule,
    ICPModule,
    CampaignsModule,
  ],
  providers: [DailyScrapeJob, DataRetentionJob, AnalyticsRollupJob, ICPRefinementJob],
})
export class JobsModule {}
