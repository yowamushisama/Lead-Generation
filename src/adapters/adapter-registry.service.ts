import { Injectable, Logger, OnModuleInit, NotFoundException } from '@nestjs/common';
import { ISourceAdapter, AdapterConfig } from '../common/interfaces/adapter.interface';
import { RawLeadInput } from '../common/interfaces/lead-input.interface';
import { CsvAdapter } from './csv/csv.adapter';
import { WebhookAdapter } from './webhook/webhook.adapter';

@Injectable()
export class AdapterRegistryService implements OnModuleInit {
  private readonly logger = new Logger(AdapterRegistryService.name);
  private readonly adapters = new Map<string, ISourceAdapter>();

  constructor(
    private readonly csvAdapter: CsvAdapter,
    private readonly webhookAdapter: WebhookAdapter,
  ) {}

  onModuleInit(): void {
    this.register(this.csvAdapter);
    this.register(this.webhookAdapter);

    this.logger.log({
      message: `Adapter registry initialized with ${this.adapters.size} adapters`,
      module: 'AdapterRegistry',
      adapters: Array.from(this.adapters.keys()),
    });
  }

  register(adapter: ISourceAdapter): void {
    if (this.adapters.has(adapter.name)) {
      this.logger.warn({
        message: `Adapter '${adapter.name}' is already registered — overwriting`,
        module: 'AdapterRegistry',
      });
    }

    this.adapters.set(adapter.name, adapter);

    this.logger.log({
      message: `Adapter registered: ${adapter.name} (${adapter.sourceType})`,
      module: 'AdapterRegistry',
    });
  }

  get(name: string): ISourceAdapter {
    const adapter = this.adapters.get(name);

    if (!adapter) {
      throw new NotFoundException(
        `Adapter '${name}' is not registered. Available: ${this.getAvailableNames().join(', ')}`,
      );
    }

    return adapter;
  }

  has(name: string): boolean {
    return this.adapters.has(name);
  }

  getAvailableNames(): string[] {
    return Array.from(this.adapters.keys());
  }

  getAll(): ISourceAdapter[] {
    return Array.from(this.adapters.values());
  }

  getByType(sourceType: 'intent' | 'discovery'): ISourceAdapter[] {
    return this.getAll().filter((adapter) => adapter.sourceType === sourceType);
  }

  async *collect(
    adapterName: string,
    config: AdapterConfig,
  ): AsyncGenerator<RawLeadInput> {
    const adapter = this.get(adapterName);
    const isHealthy = await adapter.isHealthy();

    if (!isHealthy) {
      throw new Error(`Adapter '${adapterName}' is unhealthy and cannot collect leads`);
    }

    yield* adapter.collect(config);
  }

  async healthCheck(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    await Promise.all(
      Array.from(this.adapters.entries()).map(async ([name, adapter]) => {
        try {
          results[name] = await adapter.isHealthy();
        } catch {
          results[name] = false;
        }
      }),
    );

    return results;
  }
}
