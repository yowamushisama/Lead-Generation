import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OrganizationRepository } from '../database/repositories/organization.repository';
import { ICPLearningService } from '../icp/icp-learning.service';

@Injectable()
export class ICPRefinementJob {
  private readonly logger = new Logger(ICPRefinementJob.name);

  constructor(
    private readonly organizationRepository: OrganizationRepository,
    private readonly icpLearning: ICPLearningService,
  ) {}

  @Cron('0 2 * * 1') // Monday 2:00 AM
  async run(): Promise<void> {
    this.logger.log({ message: 'ICP refinement job started' });

    const orgs = await this.organizationRepository.findMany({ select: { id: true } });

    for (const org of orgs) {
      try {
        await this.icpLearning.refineFromConversions(org.id);
      } catch (error) {
        this.logger.error({
          message: `ICP refinement failed for org ${org.id}`,
          error: String(error),
        });
      }
    }

    this.logger.log({ message: 'ICP refinement job complete', orgsProcessed: orgs.length });
  }
}
