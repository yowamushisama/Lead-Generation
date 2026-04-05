import { Injectable } from '@nestjs/common';

export interface PromptVersion {
  version: string;
  systemPrompt: string;
  createdAt: Date;
}

@Injectable()
export class PromptManagerService {
  private readonly prompts = new Map<string, PromptVersion>();

  register(key: string, systemPrompt: string, version = '1.0.0'): void {
    this.prompts.set(key, { version, systemPrompt, createdAt: new Date() });
  }

  get(key: string): PromptVersion | undefined {
    return this.prompts.get(key);
  }

  getSystemPrompt(key: string, fallback: string): string {
    return this.prompts.get(key)?.systemPrompt ?? fallback;
  }

  list(): Array<{ key: string; version: string }> {
    return Array.from(this.prompts.entries()).map(([key, p]) => ({
      key,
      version: p.version,
    }));
  }
}
