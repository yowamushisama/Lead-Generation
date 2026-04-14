import { Module } from '@nestjs/common';
import { PromptConfigService } from './prompt-config.service';
import { PromptConfigController } from './prompt-config.controller';
import { DatabaseModule } from '../database/database.module';
import { AIModule } from '../ai/ai.module';

@Module({
  imports: [DatabaseModule, AIModule],
  providers: [PromptConfigService],
  controllers: [PromptConfigController],
  exports: [PromptConfigService],
})
export class PromptConfigModule {}
