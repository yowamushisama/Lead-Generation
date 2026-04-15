import { Module } from '@nestjs/common';
import { ICPService } from './icp.service';
import { ICPController } from './icp.controller';
import { ICPLearningService } from './icp-learning.service';
import { DatabaseModule } from '../database/database.module';
import { AIModule } from '../ai/ai.module';

@Module({
  imports: [DatabaseModule, AIModule],
  providers: [ICPService, ICPLearningService],
  controllers: [ICPController],
  exports: [ICPService, ICPLearningService],
})
export class ICPModule {}
