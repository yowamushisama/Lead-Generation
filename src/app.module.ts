import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { LeadsModule } from './leads/leads.module';
import { AdaptersModule } from './adapters/adapters.module';
import { PipelineModule } from './pipeline/pipeline.module';
import { HealthModule } from './health/health.module';
import { AppConfigModule } from './config/config.module';
import { AIModule } from './ai/ai.module';
import { ScoringModule } from './scoring/scoring.module';
import { MessagesModule } from './messages/messages.module';
import { ConversationsModule } from './conversations/conversations.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { ICPModule } from './icp/icp.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { ComplianceModule } from './compliance/compliance.module';
import { JobsModule } from './jobs/jobs.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      cache: true,
    }),
    AppConfigModule,
    DatabaseModule,
    AuthModule,
    OrganizationsModule,
    LeadsModule,
    AdaptersModule,
    AIModule,
    ScoringModule,
    PipelineModule,
    MessagesModule,
    ConversationsModule,
    CampaignsModule,
    ICPModule,
    AnalyticsModule,
    ComplianceModule,
    JobsModule,
    HealthModule,
  ],
})
export class AppModule {}
