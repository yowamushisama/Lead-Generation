import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { OrchestratorService } from '../../pipeline/orchestrator.service';

@Injectable()
export class QueueHealthIndicator extends HealthIndicator {
  constructor(private readonly orchestratorService: OrchestratorService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const stats = await this.orchestratorService.getQueueStats();

      const totalFailed = Object.values(stats as Record<string, { failed: number }>).reduce(
        (sum, queue) => sum + (queue.failed ?? 0),
        0,
      );

      const isHealthy = totalFailed < 100;

      const result = this.getStatus(key, isHealthy, {
        queues: stats,
        totalFailed,
      });

      if (isHealthy) {
        return result;
      }

      throw new HealthCheckError('Queue check failed — high failure rate', result);
    } catch (error) {
      if (error instanceof HealthCheckError) {
        throw error;
      }

      const result = this.getStatus(key, false, {
        error: error instanceof Error ? error.message : String(error),
      });

      throw new HealthCheckError('Queue check failed', result);
    }
  }
}
