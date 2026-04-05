import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class AnalyticsRollupJob {
  private readonly logger = new Logger(AnalyticsRollupJob.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 1 * * *') // 1:00 AM daily
  async run(): Promise<void> {
    this.logger.log({ message: 'Analytics rollup job started' });

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const endOfYesterday = new Date(yesterday);
    endOfYesterday.setHours(23, 59, 59, 999);

    const orgs = await this.prisma.organization.findMany({ select: { id: true } });

    for (const org of orgs) {
      const [leadsCreated, messagesSent] = await Promise.all([
        this.prisma.lead.count({
          where: { organizationId: org.id, createdAt: { gte: yesterday, lte: endOfYesterday } },
        }),
        this.prisma.message.count({
          where: {
            organizationId: org.id,
            status: 'SENT',
            sentAt: { gte: yesterday, lte: endOfYesterday },
          },
        }),
      ]);

      // Upsert the daily record
      await this.prisma.usageRecord.upsert({
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
