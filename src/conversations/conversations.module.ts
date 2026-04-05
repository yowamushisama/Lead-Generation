import { Module } from '@nestjs/common';
import { ConversationsService } from './conversations.service';
import { ConversationsController } from './conversations.controller';
import { ObjectionHandlerService } from './objection-handler.service';
import { DatabaseModule } from '../database/database.module';
import { PipelineModule } from '../pipeline/pipeline.module';

@Module({
  imports: [DatabaseModule, PipelineModule],
  providers: [ConversationsService, ObjectionHandlerService],
  controllers: [ConversationsController],
  exports: [ConversationsService],
})
export class ConversationsModule {}
