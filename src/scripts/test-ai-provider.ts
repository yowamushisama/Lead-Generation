/**
 * AI Provider smoke test
 *
 * Runs four checks against the configured provider (AI_PROVIDER env var):
 *   1. Basic completion       — one-sentence reply
 *   2. Intent classification  — structured JSON matching the IntentResult schema
 *   3. Personalization        — short outreach message
 *   4. Provider routing       — model-name override selects the correct provider
 *
 * Usage:
 *   npm run ai:test
 *   npm run ai:test -- --verbose
 *   npm run ai:test -- --provider groq          # override AI_PROVIDER for this run
 *   npm run ai:test -- --classification-only
 */

import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AppConfigModule } from '../config/config.module';
import { TenantMode } from '../common/enums/tenant-mode.enum';

// ── ANSI colours ──────────────────────────────────────────────────────────────
const c = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  green:  '\x1b[32m',
  red:    '\x1b[31m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  grey:   '\x1b[90m',
};
const ok  = `${c.green}✔${c.reset}`;
const fail = `${c.red}✘${c.reset}`;
const warn = `${c.yellow}⚠${c.reset}`;

// ── Result tracking ───────────────────────────────────────────────────────────
interface TestResult {
  name: string;
  passed: boolean;
  durationMs: number;
  detail?: string;
  error?: string;
}
const results: TestResult[] = [];

async function runTest(
  name: string,
  fn: () => Promise<string>,
): Promise<void> {
  process.stdout.write(`  ${c.grey}running${c.reset} ${name} … `);
  const start = Date.now();
  try {
    const detail = await fn();
    const ms = Date.now() - start;
    results.push({ name, passed: true, durationMs: ms, detail });
    console.log(`${ok} ${c.grey}(${ms}ms)${c.reset}`);
  } catch (err) {
    const ms = Date.now() - start;
    const error = err instanceof Error ? err.message : String(err);
    results.push({ name, passed: false, durationMs: ms, error });
    console.log(`${fail} ${c.red}${error}${c.reset}`);
  }
}

// ── CLI flags ─────────────────────────────────────────────────────────────────
interface CliFlags {
  verbose: boolean;
  providerOverride?: string;
  classificationOnly: boolean;
  completionOnly: boolean;
}

function parseFlags(argv: string[]): CliFlags {
  const flags: CliFlags = { verbose: false, classificationOnly: false, completionOnly: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--verbose' || argv[i] === '-v') flags.verbose = true;
    if (argv[i] === '--classification-only')           flags.classificationOnly = true;
    if (argv[i] === '--completion-only')               flags.completionOnly = true;
    if ((argv[i] === '--provider' || argv[i] === '-p') && argv[i + 1]) {
      flags.providerOverride = argv[++i];
    }
  }
  return flags;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const flags = parseFlags(process.argv.slice(2));

  if (flags.providerOverride) {
    process.env['AI_PROVIDER'] = flags.providerOverride;
  }

  // Lazy-import providers so env overrides apply before module init
  const { AppConfigService } = await import('../config/config.service');
  const { GroqProvider }     = await import('../ai/providers/groq.provider');
  const { OpenAIProvider }   = await import('../ai/providers/openai.provider');
  const { ClaudeProvider }   = await import('../ai/providers/claude.provider');
  const { AIProviderFactory }= await import('../ai/ai-provider.factory');

  @Module({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env.local', '.env'], cache: true }),
      AppConfigModule,
    ],
    providers: [GroqProvider, OpenAIProvider, ClaudeProvider, AIProviderFactory],
  })
  class AITestModule {}

  const app = await NestFactory.createApplicationContext(AITestModule, { logger: ['error'] });

  const config  = app.get(AppConfigService);
  const factory = app.get(AIProviderFactory);
  const provider = factory.getProvider();

  console.log();
  console.log(`${c.bold}AI Provider Test${c.reset}`);
  console.log(`${'─'.repeat(50)}`);
  console.log(`  provider   : ${c.cyan}${provider.providerName}${c.reset}  (AI_PROVIDER=${config.aiProvider})`);

  if (provider.providerName === 'groq') {
    console.log(`  class model: ${c.cyan}${config.groqClassificationModel}${c.reset}`);
    console.log(`  gen model  : ${c.cyan}${config.groqPersonalizationModel}${c.reset}`);
  }

  console.log(`${'─'.repeat(50)}`);
  console.log();

  // ── Test 1: basic completion ────────────────────────────────────────────────
  if (!flags.classificationOnly) {
    await runTest('Basic completion', async () => {
      const result = await provider.complete(
        'Reply with exactly one sentence confirming you are working correctly.',
        { maxTokens: 60, temperature: 0 },
      );
      if (!result.content || result.content.trim().length < 5) {
        throw new Error(`Empty or too-short response: "${result.content}"`);
      }
      if (result.tokensUsed === 0) throw new Error('tokensUsed is 0 — usage not returned');
      if (!result.model)           throw new Error('model field is empty');
      if (flags.verbose) console.log(`\n      → "${result.content.trim()}"`);
      return `${result.tokensUsed} tokens, model=${result.model}`;
    });
  }

  // ── Test 2: intent classification (JSON schema) ─────────────────────────────
  await runTest('Intent classification — JSON schema', async () => {
    const samplePost =
      'We are evaluating CRM platforms right now. Need something that integrates with HubSpot. ' +
      'Budget is flexible — looking for enterprise pricing. Decision by end of quarter.';

    const context = { organizationId: 'test-org', userId: 'test-user', mode: TenantMode.SINGLE };
    const result  = await provider.classifyIntent(samplePost, context);

    const required = [
      'intentType', 'intentUrgency', 'intentConfidence',
      'isBuyer', 'intentReasoning', 'painPoints', 'fears', 'desires', 'hiringIntent',
    ];
    const missing = required.filter((k) => !(k in result));
    if (missing.length) throw new Error(`Missing fields: ${missing.join(', ')}`);

    if (typeof result.intentConfidence !== 'number' || result.intentConfidence < 0 || result.intentConfidence > 1) {
      throw new Error(`intentConfidence out of range: ${result.intentConfidence}`);
    }
    if (!Array.isArray(result.painPoints)) throw new Error('painPoints is not an array');
    if (typeof result.isBuyer !== 'boolean')  throw new Error('isBuyer is not a boolean');

    const validTypes = ['BUYING', 'HIRING', 'PARTNERSHIP', 'RESEARCH', 'COMPLAINING', 'COMPARING', 'EXPLORING', 'UNKNOWN'];
    if (!validTypes.includes(result.intentType)) {
      throw new Error(`Unknown intentType: "${result.intentType}"`);
    }

    if (flags.verbose) {
      console.log(`\n      intentType=${result.intentType}  confidence=${result.intentConfidence.toFixed(2)}  isBuyer=${result.isBuyer}`);
      console.log(`      reasoning: ${result.intentReasoning}`);
    }

    return `intentType=${result.intentType}  confidence=${result.intentConfidence.toFixed(2)}  isBuyer=${result.isBuyer}`;
  });

  // ── Test 3: high-intent signal correctly classified ─────────────────────────
  await runTest('Intent classification — high-intent signal', async () => {
    const highIntentPost =
      'Just got budget approved. We need to purchase a lead generation tool this week. ' +
      'Who has the best b2b prospecting solution? Ready to sign a contract.';

    const context = { organizationId: 'test-org', userId: 'test-user', mode: TenantMode.SINGLE };
    const result  = await provider.classifyIntent(highIntentPost, context);

    if (!result.isBuyer) {
      throw new Error(`Expected isBuyer=true for a clear purchase-intent post, got false`);
    }
    if (result.intentConfidence < 0.5) {
      throw new Error(`Expected confidence ≥ 0.5, got ${result.intentConfidence}`);
    }
    const buyingTypes = ['BUYING'];
    if (!buyingTypes.includes(result.intentType)) {
      throw new Error(`Expected BUYING intent type, got "${result.intentType}"`);
    }
    return `intentType=${result.intentType}  confidence=${result.intentConfidence.toFixed(2)} ✓`;
  });

  // ── Test 4: personalization / outreach generation ───────────────────────────
  if (!flags.classificationOnly) {
    await runTest('Personalization — outreach message quality', async () => {
      const prompt =
        'Write a short 2-sentence LinkedIn outreach message to a CTO at a Series-A SaaS startup ' +
        'who posted about evaluating data pipelines. Be professional and specific. Do not use generic openers.';

      const result = await provider.complete(prompt, {
        maxTokens: 150,
        temperature: 0.6,
        systemPrompt: 'You are an expert B2B sales copywriter. Write concise, personalised outreach only.',
      });

      if (!result.content || result.content.trim().length < 30) {
        throw new Error(`Response too short: "${result.content}"`);
      }
      const wordCount = result.content.trim().split(/\s+/).length;
      if (wordCount < 10) throw new Error(`Word count too low: ${wordCount}`);

      const lowerContent = result.content.toLowerCase();
      const genericOpeners = ["hope this finds you", "i hope you're doing well", "i am reaching out"];
      const usedGeneric = genericOpeners.find((o) => lowerContent.includes(o));
      if (usedGeneric) throw new Error(`Used generic opener: "${usedGeneric}"`);

      if (flags.verbose) console.log(`\n      → "${result.content.trim()}"`);
      return `${wordCount} words, ${result.tokensUsed} tokens`;
    });
  }

  // ── Test 5: provider routing via model-name prefix ──────────────────────────
  if (!flags.classificationOnly && !flags.completionOnly) {
    await runTest('Provider routing — model-name prefix', async () => {
      const groqProvider  = factory.getProvider('llama-3.3-70b-versatile');
      const openAiProvider = factory.getProvider('gpt-4o');
      const claudeProvider = factory.getProvider('claude-haiku-4-5-20251001');

      if (groqProvider.providerName !== 'groq')
        throw new Error(`llama model → expected groq, got ${groqProvider.providerName}`);
      if (openAiProvider.providerName !== 'openai')
        throw new Error(`gpt model → expected openai, got ${openAiProvider.providerName}`);
      if (claudeProvider.providerName !== 'anthropic')
        throw new Error(`claude model → expected anthropic, got ${claudeProvider.providerName}`);

      return 'llama→groq  gpt→openai  claude→anthropic';
    });
  }

  // ── Summary ──────────────────────────────────────────────────────────────────
  await app.close();

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const totalMs = results.reduce((s, r) => s + r.durationMs, 0);

  console.log();
  console.log(`${'─'.repeat(50)}`);
  console.log(`${c.bold}Results${c.reset}: ${c.green}${passed} passed${c.reset}  ${failed > 0 ? `${c.red}${failed} failed${c.reset}` : `${c.grey}0 failed${c.reset}`}  ${c.grey}(${totalMs}ms total)${c.reset}`);

  if (flags.verbose || failed > 0) {
    console.log();
    for (const r of results) {
      const icon = r.passed ? ok : fail;
      console.log(`  ${icon} ${r.name}  ${c.grey}(${r.durationMs}ms)${c.reset}`);
      if (r.detail)  console.log(`       ${c.grey}${r.detail}${c.reset}`);
      if (r.error)   console.log(`       ${c.red}${r.error}${c.reset}`);
    }
  }

  console.log();

  if (failed > 0) {
    console.log(`${warn}  ${failed} test(s) failed. Check your API key and model availability.`);
    console.log(`    .env.local should contain: GROQ_API_KEY=<your key>`);
    process.exit(1);
  } else {
    console.log(`${ok}  All tests passed. Provider is working correctly.`);
  }
}

void main().catch((err) => {
  console.error(`${fail} Fatal error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
