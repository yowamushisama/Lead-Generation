import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CampaignRepository } from '../database/repositories/campaign.repository';
import { OrganizationRepository } from '../database/repositories/organization.repository';
import { CampaignRunnerService } from '../campaigns/campaign-runner.service';

@Injectable()
export class DailyScrapeJob {
  private readonly logger = new Logger(DailyScrapeJob.name);

  constructor(
    private readonly organizationRepository: OrganizationRepository,
    private readonly campaignRepository: CampaignRepository,
    private readonly campaignRunner: CampaignRunnerService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async run(): Promise<void> {
    this.logger.log({ message: 'Daily scrape job started' });

    const activeOrgs = await this.organizationRepository.findMany({
      where: { users: { some: {} } },
      select: { id: true },
    });

    let totalEnqueued = 0;

    for (const org of activeOrgs) {
      const campaigns = await this.campaignRepository.findMany({
        where: { organizationId: org.id, isActive: true, status: 'ACTIVE' },
        select: { id: true, keywords: true, targetLocations: true, targetIndustries: true },
      });

      for (const campaign of campaigns) {
        try {
          const summary = await this.campaignRunner.runCampaign(
            this.campaignRunner.buildSystemTenant(org.id),
            campaign.id,
            'scheduled',
          );
          totalEnqueued += summary.enqueued;
        } catch (error) {
          this.logger.error({
            message: 'Scheduled campaign run failed',
            organizationId: org.id,
            campaignId: campaign.id,
            error: String(error),
          });
        }
      }
    }

    this.logger.log({ message: `Daily scrape complete`, totalEnqueued });
  }
}
