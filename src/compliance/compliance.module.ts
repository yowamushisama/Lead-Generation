import { Module } from '@nestjs/common';
import { ComplianceService } from './compliance.service';
import { ComplianceController } from './compliance.controller';
import { DataRetentionService } from './data-retention.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [ComplianceService, DataRetentionService],
  controllers: [ComplianceController],
  exports: [ComplianceService, DataRetentionService],
})
export class ComplianceModule {}
