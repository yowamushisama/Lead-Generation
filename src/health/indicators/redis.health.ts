import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult, HealthCheckError } from '@nestjs/terminus';
import { RedisService } from '../../database/redis.service';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(private readonly redisService: RedisService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const isHealthy = await this.redisService.isHealthy();

      const result = this.getStatus(key, isHealthy, {
        type: 'redis',
        provider: 'upstash',
      });

      if (isHealthy) {
        return result;
      }

      throw new HealthCheckError('Redis check failed', result);
    } catch (error) {
      if (error instanceof HealthCheckError) {
        throw error;
      }

      const result = this.getStatus(key, false, {
        type: 'redis',
        error: error instanceof Error ? error.message : String(error),
      });

      throw new HealthCheckError('Redis check failed', result);
    }
  }
}
