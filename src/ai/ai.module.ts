import { Module } from '@nestjs/common';
import { OpenAIProvider } from './providers/openai.provider';
import { ClaudeProvider } from './providers/claude.provider';
import { AIProviderFactory } from './ai-provider.factory';
import { PromptManagerService } from './prompt-manager.service';
import { AppConfigModule } from '../config/config.module';

@Module({
  imports: [AppConfigModule],
  providers: [OpenAIProvider, ClaudeProvider, AIProviderFactory, PromptManagerService],
  exports: [AIProviderFactory, PromptManagerService, OpenAIProvider, ClaudeProvider],
})
export class AIModule {}
