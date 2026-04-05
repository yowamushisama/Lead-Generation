import { Module } from '@nestjs/common';
import { MessagesService } from './messages.service';
import { MessagesController } from './messages.controller';
import { AntiSpamService } from './anti-spam.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [MessagesService, AntiSpamService],
  controllers: [MessagesController],
  exports: [MessagesService, AntiSpamService],
})
export class MessagesModule {}
