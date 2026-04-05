import { Injectable } from '@nestjs/common';
import { IAIProvider } from '../common/interfaces/ai-provider.interface';
import { OpenAIProvider } from './providers/openai.provider';
import { ClaudeProvider } from './providers/claude.provider';
import { AppConfigService } from '../config/config.service';

@Injectable()
export class AIProviderFactory {
  constructor(
    private readonly openAiProvider: OpenAIProvider,
    private readonly claudeProvider: ClaudeProvider,
    private readonly config: AppConfigService,
  ) {}

  getProvider(modelName?: string): IAIProvider {
    if (!modelName) {
      return this.openAiProvider;
    }
    if (modelName.startsWith('claude')) {
      return this.claudeProvider;
    }
    return this.openAiProvider;
  }

  getClassificationProvider(orgModel?: string): IAIProvider {
    const model = orgModel ?? this.config.openAiApiKey ? 'gpt-4o-mini' : 'claude-haiku-4-5-20251001';
    return this.getProvider(model);
  }

  getPersonalizationProvider(orgModel?: string): IAIProvider {
    const model = orgModel ?? 'gpt-4o';
    return this.getProvider(model);
  }
}
