import { Test, TestingModule } from '@nestjs/testing';
import { AIProviderFactory } from './ai-provider.factory';
import { OpenAIProvider } from './providers/openai.provider';
import { ClaudeProvider } from './providers/claude.provider';
import { GroqProvider } from './providers/groq.provider';
import { AppConfigService } from '../config/config.service';

const makeConfig = (overrides: Partial<AppConfigService> = {}): AppConfigService =>
  ({
    aiProvider: 'groq',
    groqApiKey: 'gsk_test',
    openAiApiKey: undefined,
    anthropicApiKey: undefined,
    groqClassificationModel: 'llama-3.1-8b-instant',
    groqPersonalizationModel: 'llama-3.3-70b-versatile',
    ...overrides,
  }) as unknown as AppConfigService;

const makeProviders = () => {
  const groq    = { providerName: 'groq' }    as unknown as GroqProvider;
  const openai  = { providerName: 'openai' }  as unknown as OpenAIProvider;
  const claude  = { providerName: 'anthropic' } as unknown as ClaudeProvider;
  return { groq, openai, claude };
};

describe('AIProviderFactory', () => {
  let factory: AIProviderFactory;
  let providers: ReturnType<typeof makeProviders>;

  async function build(configOverrides: Partial<AppConfigService> = {}) {
    providers = makeProviders();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AIProviderFactory,
        { provide: GroqProvider,   useValue: providers.groq   },
        { provide: OpenAIProvider, useValue: providers.openai },
        { provide: ClaudeProvider, useValue: providers.claude },
        { provide: AppConfigService, useValue: makeConfig(configOverrides) },
      ],
    }).compile();
    factory = module.get(AIProviderFactory);
  }

  describe('default provider routing via AI_PROVIDER', () => {
    it('returns GroqProvider when AI_PROVIDER=groq', async () => {
      await build({ aiProvider: 'groq' });
      expect(factory.getProvider().providerName).toBe('groq');
    });

    it('returns OpenAIProvider when AI_PROVIDER=openai', async () => {
      await build({ aiProvider: 'openai' });
      expect(factory.getProvider().providerName).toBe('openai');
    });

    it('returns ClaudeProvider when AI_PROVIDER=anthropic', async () => {
      await build({ aiProvider: 'anthropic' });
      expect(factory.getProvider().providerName).toBe('anthropic');
    });

    it('defaults to groq for unknown AI_PROVIDER value', async () => {
      await build({ aiProvider: 'unknown-provider' });
      expect(factory.getProvider().providerName).toBe('groq');
    });
  });

  describe('model-name prefix routing', () => {
    beforeEach(() => build());

    it('routes claude* models to ClaudeProvider', () => {
      expect(factory.getProvider('claude-opus-4-7').providerName).toBe('anthropic');
      expect(factory.getProvider('claude-haiku-4-5').providerName).toBe('anthropic');
    });

    it('routes llama* models to GroqProvider', () => {
      expect(factory.getProvider('llama-3.1-8b-instant').providerName).toBe('groq');
      expect(factory.getProvider('llama-3.3-70b-versatile').providerName).toBe('groq');
    });

    it('routes mixtral* models to GroqProvider', () => {
      expect(factory.getProvider('mixtral-8x7b').providerName).toBe('groq');
    });

    it('routes gemma* models to GroqProvider', () => {
      expect(factory.getProvider('gemma2-9b-it').providerName).toBe('groq');
    });

    it('routes qwen* models to GroqProvider', () => {
      expect(factory.getProvider('qwen-32b').providerName).toBe('groq');
    });

    it('routes gpt* models to OpenAIProvider', () => {
      expect(factory.getProvider('gpt-4o').providerName).toBe('openai');
      expect(factory.getProvider('gpt-4o-mini').providerName).toBe('openai');
    });

    it('routes unknown model names to OpenAIProvider', () => {
      expect(factory.getProvider('unknown-model-xyz').providerName).toBe('openai');
    });
  });

  describe('getClassificationProvider / getPersonalizationProvider', () => {
    beforeEach(() => build({ aiProvider: 'groq' }));

    it('falls back to default when no model name given', () => {
      expect(factory.getClassificationProvider().providerName).toBe('groq');
      expect(factory.getPersonalizationProvider().providerName).toBe('groq');
    });

    it('overrides provider via explicit model name', () => {
      expect(factory.getClassificationProvider('claude-haiku-4-5').providerName).toBe('anthropic');
      expect(factory.getPersonalizationProvider('gpt-4o').providerName).toBe('openai');
    });
  });

  describe('provider construction — missing API keys do not throw at module init', () => {
    it('GroqProvider constructs without GROQ_API_KEY', () => {
      const config = makeConfig({ groqApiKey: undefined });
      expect(() => new GroqProvider(config as AppConfigService)).not.toThrow();
    });

    it('ClaudeProvider constructs without ANTHROPIC_API_KEY', () => {
      const config = makeConfig({ anthropicApiKey: undefined });
      expect(() => new ClaudeProvider(config as AppConfigService)).not.toThrow();
    });

    it('GroqProvider throws on first use when GROQ_API_KEY is absent', async () => {
      const config = makeConfig({ groqApiKey: undefined });
      const provider = new GroqProvider(config as AppConfigService);
      await expect(provider.complete('hello')).rejects.toThrow('GROQ_API_KEY');
    });

    it('ClaudeProvider throws on first use when ANTHROPIC_API_KEY is absent', async () => {
      const config = makeConfig({ anthropicApiKey: undefined });
      const provider = new ClaudeProvider(config as AppConfigService);
      await expect(provider.complete('hello')).rejects.toThrow('ANTHROPIC_API_KEY');
    });
  });
});
