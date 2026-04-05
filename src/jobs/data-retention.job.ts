import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataRetentionService } from '../compliance/data-retention.service';

@Injectable()
export class DataRetentionJob {
  private readonly logger = new Logger(DataRetentionJob.name);

  constructor(private readonly dataRetention: DataRetentionService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async run(): Promise<void> {
    this.logger.log({ message: 'Data retention job started' });
    const result = await this.dataRetention.purgeExpiredData();
    this.logger.log({ message: 'Data retention job complete', ...result });
  }
}
