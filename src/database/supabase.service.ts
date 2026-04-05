import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseService.name);
  private adminClient!: SupabaseClient;
  private anonClient!: SupabaseClient;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseAnonKey = this.configService.get<string>('SUPABASE_ANON_KEY');
    const supabaseServiceRoleKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      this.logger.warn({
        message: 'Supabase credentials not fully configured — some features may be unavailable',
        module: 'SupabaseService',
      });

      const fallbackUrl = supabaseUrl ?? 'https://placeholder.supabase.co';
      const fallbackKey = supabaseAnonKey ?? 'placeholder';
      const fallbackServiceKey = supabaseServiceRoleKey ?? 'placeholder';

      this.anonClient = createClient(fallbackUrl, fallbackKey);
      this.adminClient = createClient(fallbackUrl, fallbackServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
      return;
    }

    this.anonClient = createClient(supabaseUrl, supabaseAnonKey);

    this.adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    this.logger.log({
      message: 'Supabase clients initialized',
      module: 'SupabaseService',
    });
  }

  getAdminClient(): SupabaseClient {
    return this.adminClient;
  }

  getAnonClient(): SupabaseClient {
    return this.anonClient;
  }

  async verifyToken(token: string): Promise<{ userId: string; email: string } | null> {
    try {
      const { data, error } = await this.adminClient.auth.getUser(token);

      if (error || !data.user) {
        return null;
      }

      return {
        userId: data.user.id,
        email: data.user.email ?? '',
      };
    } catch {
      return null;
    }
  }

  async createUser(
    email: string,
    password: string,
  ): Promise<{ id: string; email: string } | null> {
    try {
      const { data, error } = await this.adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });

      if (error || !data.user) {
        this.logger.error({
          message: `Failed to create Supabase user: ${error?.message}`,
          module: 'SupabaseService',
        });
        return null;
      }

      return {
        id: data.user.id,
        email: data.user.email ?? email,
      };
    } catch (error) {
      this.logger.error({
        message: 'Exception creating Supabase user',
        module: 'SupabaseService',
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      const { error } = await this.adminClient.from('Organization').select('id').limit(1);
      return !error;
    } catch {
      return false;
    }
  }
}
