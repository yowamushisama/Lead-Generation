import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client!: Redis;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const redisUrl = this.configService.get<string>('REDIS_URL');

    if (redisUrl) {
      this.client = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        lazyConnect: false,
        enableReadyCheck: true,
      });
    } else {
      this.client = new Redis({
        host: this.configService.get<string>('REDIS_HOST') ?? 'localhost',
        port: parseInt(this.configService.get<string>('REDIS_PORT') ?? '6379', 10),
        password: this.configService.get<string>('REDIS_PASSWORD'),
        maxRetriesPerRequest: 3,
        lazyConnect: false,
        enableReadyCheck: true,
      });
    }

    this.client.on('connect', () => {
      this.logger.log({
        message: 'Redis connected',
        module: 'RedisService',
      });
    });

    this.client.on('error', (err: Error) => {
      this.logger.error({
        message: `Redis error: ${err.message}`,
        module: 'RedisService',
      });
    });

    this.client.on('reconnecting', () => {
      this.logger.warn({
        message: 'Redis reconnecting...',
        module: 'RedisService',
      });
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
    this.logger.log({
      message: 'Redis disconnected',
      module: 'RedisService',
    });
  }

  getClient(): Redis {
    return this.client;
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.setex(key, ttlSeconds, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  async hget(key: string, field: string): Promise<string | null> {
    return this.client.hget(key, field);
  }

  async hset(key: string, field: string, value: string): Promise<void> {
    await this.client.hset(key, field, value);
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    return this.client.hgetall(key);
  }

  async incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  async expire(key: string, seconds: number): Promise<void> {
    await this.client.expire(key, seconds);
  }

  async isHealthy(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }
}
