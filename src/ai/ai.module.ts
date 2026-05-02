import { Module } from '@nestjs/common';
import { OpenAIProvider } from './providers/openai.provider';
import { ClaudeProvider } from './providers/claude.provider';
import { GroqProvider } from './providers/groq.provider';
import { AIProviderFactory } from './ai-provider.factory';
import { PromptManagerService } from './prompt-manager.service';
import { AppConfigModule } from '../config/config.module';

@Module({
  imports: [AppConfigModule],
  providers: [GroqProvider, OpenAIProvider, ClaudeProvider, AIProviderFactory, PromptManagerService],
  exports: [AIProviderFactory, PromptManagerService, GroqProvider, OpenAIProvider, ClaudeProvider],
})
export class AIModule {}
