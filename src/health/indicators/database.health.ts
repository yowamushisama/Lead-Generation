import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class DatabaseHealthIndicator extends HealthIndicator {
  constructor(private readonly prismaService: PrismaService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const isHealthy = await this.prismaService.isHealthy();

      const result = this.getStatus(key, isHealthy, {
        type: 'postgresql',
        provider: 'supabase',
      });

      if (isHealthy) {
        return result;
      }

      throw new HealthCheckError('Database check failed', result);
    } catch (error) {
      if (error instanceof HealthCheckError) {
        throw error;
      }

      const result = this.getStatus(key, false, {
        type: 'postgresql',
        error: error instanceof Error ? error.message : String(error),
      });

      throw new HealthCheckError('Database check failed', result);
    }
  }
}
