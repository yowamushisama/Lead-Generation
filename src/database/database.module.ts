import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { RedisService } from './redis.service';
import { SupabaseService } from './supabase.service';
import { PrismaTransactionService } from './repositories/prisma-transaction.service';
import { LeadRepository } from './repositories/lead.repository';
import { CampaignRepository } from './repositories/campaign.repository';
import { MessageRepository } from './repositories/message.repository';
import { ConversationRepository } from './repositories/conversation.repository';
import { OrganizationRepository } from './repositories/organization.repository';
import { IcpProfileRepository } from './repositories/icp-profile.repository';
import { UsageRecordRepository } from './repositories/usage-record.repository';
import { AnalyticsEventRepository } from './repositories/analytics-event.repository';
import { UserRepository } from './repositories/user.repository';
import { LinkedInRunRepository } from './repositories/linkedin-run.repository';
import { ReportArtifactRepository } from './repositories/report-artifact.repository';

@Global()
@Module({
  providers: [
    PrismaService,
    RedisService,
    SupabaseService,
    PrismaTransactionService,
    LeadRepository,
    CampaignRepository,
    MessageRepository,
    ConversationRepository,
    OrganizationRepository,
    IcpProfileRepository,
    UsageRecordRepository,
    AnalyticsEventRepository,
    UserRepository,
    LinkedInRunRepository,
    ReportArtifactRepository,
  ],
  exports: [
    PrismaService,
    RedisService,
    SupabaseService,
    PrismaTransactionService,
    LeadRepository,
    CampaignRepository,
    MessageRepository,
    ConversationRepository,
    OrganizationRepository,
    IcpProfileRepository,
    UsageRecordRepository,
    AnalyticsEventRepository,
    UserRepository,
    LinkedInRunRepository,
    ReportArtifactRepository,
  ],
})
export class DatabaseModule {}
