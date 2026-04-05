import { Logger } from '@nestjs/common';
import { ISourceAdapter, AdapterConfig } from '../common/interfaces/adapter.interface';
import { RawLeadInput } from '../common/interfaces/lead-input.interface';

export abstract class BaseAdapter implements ISourceAdapter {
  protected readonly logger: Logger;

  abstract readonly name: string;
  abstract readonly sourceType: 'intent' | 'discovery';

  constructor() {
    this.logger = new Logger(this.constructor.name);
  }

  abstract isHealthy(): Promise<boolean>;
  abstract collect(config: AdapterConfig): AsyncGenerator<RawLeadInput>;

  protected validateConfig(config: AdapterConfig): void {
    if (!config.organizationId) {
      throw new Error('organizationId is required in adapter config');
    }
  }

  protected log(message: string, extra?: Record<string, unknown>): void {
    this.logger.log({
      message,
      module: this.name,
      adapter: this.name,
      ...extra,
    });
  }

  protected logError(message: string, error?: unknown): void {
    this.logger.error({
      message,
      module: this.name,
      adapter: this.name,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  protected logWarn(message: string, extra?: Record<string, unknown>): void {
    this.logger.warn({
      message,
      module: this.name,
      adapter: this.name,
      ...extra,
    });
  }

  protected sanitizeText(text: string): string {
    return text
      .replace(/\s+/g, ' ')
      .replace(/[^\x20-\x7E\n]/g, '')
      .trim();
  }

  protected buildSourceUrl(base: string, path: string): string {
    return `${base.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
  }
}
