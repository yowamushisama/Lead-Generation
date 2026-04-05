import { TenantMode } from '../common/enums/tenant-mode.enum';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../database/prisma.service';
import { AdapterRegistryService } from '../adapters/adapter-registry.service';
import { OrchestratorService } from '../pipeline/orchestrator.service';

@Injectable()
export class DailyScrapeJob {
  private readonly logger = new Logger(DailyScrapeJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly adapterRegistry: AdapterRegistryService,
    private readonly orchestrator: OrchestratorService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async run(): Promise<void> {
    this.logger.log({ message: 'Daily scrape job started' });

    const activeOrgs = await this.prisma.organization.findMany({
      where: { users: { some: {} } },
      select: { id: true },
    });

    let totalEnqueued = 0;

    for (const org of activeOrgs) {
      const adapters = this.adapterRegistry.getAll();

      for (const adapter of adapters) {
        const healthy = await adapter.isHealthy().catch(() => false);
        if (!healthy) continue;

        try {
          const config = { organizationId: org.id };
          for await (const lead of adapter.collect(config)) {
            await this.orchestrator.enqueueLead(lead, {
              organizationId: org.id,
              userId: 'system',
              mode: TenantMode.SINGLE,
            });
            totalEnqueued++;
          }
        } catch (error) {
          this.logger.error({
            message: `Adapter collect failed: ${adapter.name}`,
            organizationId: org.id,
            error: String(error),
          });
        }
      }
    }

    this.logger.log({ message: `Daily scrape complete`, totalEnqueued });
  }
}
