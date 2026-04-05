import { Module } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { UsageMeteringService } from './usage-metering.service';
import { AnalyticsEventService } from './events/analytics-event.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [AnalyticsService, UsageMeteringService, AnalyticsEventService],
  controllers: [AnalyticsController],
  exports: [AnalyticsService, UsageMeteringService, AnalyticsEventService],
})
export class AnalyticsModule {}
