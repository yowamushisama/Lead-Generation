import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TenantMode } from '../common/enums/tenant-mode.enum';

@Injectable()
export class AppConfigService {
  constructor(private readonly configService: ConfigService) {}

  get nodeEnv(): string {
    return this.configService.get<string>('NODE_ENV') ?? 'development';
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get isDevelopment(): boolean {
    return this.nodeEnv === 'development';
  }

  get port(): number {
    return parseInt(this.configService.get<string>('PORT') ?? '3000', 10);
  }

  get appName(): string {
    return this.configService.get<string>('APP_NAME') ?? 'lead-generation-engine';
  }

  get tenantMode(): TenantMode {
    return (this.configService.get<string>('TENANT_MODE') as TenantMode) ?? TenantMode.SINGLE;
  }

  get defaultOrganizationId(): string {
    return this.configService.get<string>('DEFAULT_ORGANIZATION_ID') ?? 'default';
  }

  get databaseUrl(): string {
    return this.getRequired('DATABASE_URL');
  }

  get directUrl(): string {
    return this.getRequired('DIRECT_URL');
  }

  get supabaseUrl(): string {
    return this.getRequired('SUPABASE_URL');
  }

  get supabaseAnonKey(): string {
    return this.getRequired('SUPABASE_ANON_KEY');
  }

  get supabaseServiceRoleKey(): string {
    return this.getRequired('SUPABASE_SERVICE_ROLE_KEY');
  }

  get redisUrl(): string {
    return this.configService.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
  }

  get redisHost(): string {
    return this.configService.get<string>('REDIS_HOST') ?? 'localhost';
  }

  get redisPort(): number {
    return parseInt(this.configService.get<string>('REDIS_PORT') ?? '6379', 10);
  }

  get redisPassword(): string | undefined {
    return this.configService.get<string>('REDIS_PASSWORD');
  }

  get jwtSecret(): string {
    return this.getRequired('JWT_SECRET');
  }

  get jwtExpiresIn(): string {
    return this.configService.get<string>('JWT_EXPIRES_IN') ?? '7d';
  }

  get openAiApiKey(): string | undefined {
    return this.configService.get<string>('OPENAI_API_KEY');
  }

  get anthropicApiKey(): string | undefined {
    return this.configService.get<string>('ANTHROPIC_API_KEY');
  }

  get groqApiKey(): string | undefined {
    return this.configService.get<string>('GROQ_API_KEY');
  }

  /** Which provider to use: groq | openai | anthropic */
  get aiProvider(): string {
    return this.configService.get<string>('AI_PROVIDER') ?? 'groq';
  }

  /** Model for fast classification tasks (intent detection, scoring) */
  get groqClassificationModel(): string {
    return this.configService.get<string>('GROQ_CLASSIFICATION_MODEL') ?? 'llama-3.1-8b-instant';
  }

  /** Model for high-quality generation tasks (outreach, personalization) */
  get groqPersonalizationModel(): string {
    return this.configService.get<string>('GROQ_PERSONALIZATION_MODEL') ?? 'llama-3.3-70b-versatile';
  }

  get dataRetentionDays(): number {
    return parseInt(this.configService.get<string>('DATA_RETENTION_DAYS') ?? '90', 10);
  }

  get logLevel(): string {
    return this.configService.get<string>('LOG_LEVEL') ?? 'debug';
  }

  private getRequired(key: string): string {
    const value = this.configService.get<string>(key);
    if (!value) {
      throw new Error(`Required environment variable ${key} is not set`);
    }
    return value;
  }
}
