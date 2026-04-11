import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' },
      ],
    });
  }

  async onModuleInit(): Promise<void> {
    const maxRetries = 5;
    const retryDelayMs = 3000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await this.$connect();
        this.logger.log({
          message: 'Prisma connected to database',
          module: 'PrismaService',
        });

        this.$on('error' as never, (event: { message: string; target: string }) => {
          this.logger.error({
            message: `Prisma error: ${event.message}`,
            module: 'PrismaService',
            target: event.target,
          });
        });
        return;
      } catch (error) {
        this.logger.warn({
          message: `Database connection attempt ${attempt}/${maxRetries} failed — ${error instanceof Error ? error.message : String(error)}`,
          module: 'PrismaService',
        });
        if (attempt < maxRetries) {
          await new Promise((res) => setTimeout(res, retryDelayMs));
        } else {
          this.logger.error({
            message: 'All database connection attempts failed',
            module: 'PrismaService',
          });
          throw error;
        }
      }
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log({
      message: 'Prisma disconnected from database',
      module: 'PrismaService',
    });
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
