import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LeadRepository } from '../database/repositories/lead.repository';
import { MessageRepository } from '../database/repositories/message.repository';
import { OrganizationRepository } from '../database/repositories/organization.repository';
import { UsageRecordRepository } from '../database/repositories/usage-record.repository';

@Injectable()
export class AnalyticsRollupJob {
  private readonly logger = new Logger(AnalyticsRollupJob.name);

  constructor(
    private readonly organizationRepository: OrganizationRepository,
    private readonly leadRepository: LeadRepository,
    private readonly messageRepository: MessageRepository,
    private readonly usageRecordRepository: UsageRecordRepository,
  ) {}

  @Cron('0 1 * * *') // 1:00 AM daily
  async run(): Promise<void> {
    this.logger.log({ message: 'Analytics rollup job started' });

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const endOfYesterday = new Date(yesterday);
    endOfYesterday.setHours(23, 59, 59, 999);

    const orgs = await this.organizationRepository.findMany({ select: { id: true } });

    for (const org of orgs) {
      const [leadsCreated, messagesSent] = await Promise.all([
        this.leadRepository.count({
          where: { organizationId: org.id, createdAt: { gte: yesterday, lte: endOfYesterday } },
        }),
        this.messageRepository.count({
          where: {
            organizationId: org.id,
            status: 'SENT',
            sentAt: { gte: yesterday, lte: endOfYesterday },
          },
        }),
      ]);

      // Upsert the daily record
      await this.usageRecordRepository.upsert({
        where: { organizationId_date: { organizationId: org.id, date: yesterday } },
        update: { leadsProcessed: leadsCreated, updatedAt: new Date() },
        create: {
          organizationId: org.id,
          date: yesterday,
          leadsProcessed: leadsCreated,
          aiTokensUsed: 0,
          scrapeRequests: messagesSent,
        },
      });
    }

    this.logger.log({ message: 'Analytics rollup complete', orgsProcessed: orgs.length });
  }
}
