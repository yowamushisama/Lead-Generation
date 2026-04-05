import { Module } from '@nestjs/common';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { DeduplicationService } from './deduplication.service';
import { HashUtil } from '../common/utils/hash.util';
import { DeduplicatorUtil } from '../common/utils/deduplicator.util';

@Module({
  controllers: [LeadsController],
  providers: [LeadsService, DeduplicationService, HashUtil, DeduplicatorUtil],
  exports: [LeadsService, DeduplicationService],
})
export class LeadsModule {}
