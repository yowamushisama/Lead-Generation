import { Injectable } from '@nestjs/common';
import { IAIProvider } from '../common/interfaces/ai-provider.interface';
import { OpenAIProvider } from './providers/openai.provider';
import { ClaudeProvider } from './providers/claude.provider';
import { GroqProvider } from './providers/groq.provider';
import { AppConfigService } from '../config/config.service';

@Injectable()
export class AIProviderFactory {
  constructor(
    private readonly openAiProvider: OpenAIProvider,
    private readonly claudeProvider: ClaudeProvider,
    private readonly groqProvider: GroqProvider,
    private readonly config: AppConfigService,
  ) {}

  /**
   * Returns the active provider based on AI_PROVIDER env var (default: groq).
   * Override at the call site by passing an explicit model name prefix:
   *   'claude*' → Anthropic, 'llama*'|'groq*'|'mixtral*'|'gemma*' → Groq, anything else → OpenAI.
   */
  getProvider(modelName?: string): IAIProvider {
    if (modelName) {
      if (modelName.startsWith('claude')) return this.claudeProvider;
      if (this.isGroqModel(modelName)) return this.groqProvider;
      return this.openAiProvider;
    }
    return this.getDefaultProvider();
  }

  /** If a model name is given it selects the provider by prefix; otherwise uses AI_PROVIDER default. */
  getClassificationProvider(modelName?: string): IAIProvider {
    return modelName ? this.getProvider(modelName) : this.getDefaultProvider();
  }

  getPersonalizationProvider(modelName?: string): IAIProvider {
    return modelName ? this.getProvider(modelName) : this.getDefaultProvider();
  }

  private getDefaultProvider(): IAIProvider {
    switch (this.config.aiProvider) {
      case 'anthropic': return this.claudeProvider;
      case 'openai':    return this.openAiProvider;
      default:          return this.groqProvider;
    }
  }

  private isGroqModel(name: string): boolean {
    return (
      name.startsWith('llama') ||
      name.startsWith('mixtral') ||
      name.startsWith('gemma') ||
      name.startsWith('groq') ||
      name.startsWith('whisper') ||
      name.startsWith('qwen')
    );
  }
}
