import { Injectable, Logger } from '@nestjs/common';
import { HashUtil } from './hash.util';

interface DeduplicationEntry {
  hash: string;
  seenAt: Date;
  count: number;
}

@Injectable()
export class DeduplicatorUtil {
  private readonly logger = new Logger(DeduplicatorUtil.name);
  private readonly inMemoryStore = new Map<string, DeduplicationEntry>();

  constructor(private readonly hashUtil: HashUtil) {}

  computeLeadHash(data: {
    name: string;
    email?: string;
    company?: string;
    source: string;
    organizationId: string;
  }): string {
    const normalized = {
      name: data.name.toLowerCase().trim(),
      email: data.email?.toLowerCase().trim() ?? '',
      company: data.company?.toLowerCase().trim() ?? '',
      source: data.source.toLowerCase(),
      organizationId: data.organizationId,
    };

    return this.hashUtil.sha256(JSON.stringify(normalized));
  }

  computeContentHash(content: string): string {
    return this.hashUtil.sha256(content.toLowerCase().trim());
  }

  isDuplicateInMemory(hash: string, namespace: string): boolean {
    const key = `${namespace}:${hash}`;
    const entry = this.inMemoryStore.get(key);

    if (entry) {
      entry.count += 1;
      this.logger.debug({
        message: `Duplicate detected in memory`,
        module: 'Deduplicator',
        hash,
        namespace,
        count: entry.count,
      });
      return true;
    }

    this.inMemoryStore.set(key, {
      hash,
      seenAt: new Date(),
      count: 1,
    });

    return false;
  }

  markAsSeen(hash: string, namespace: string): void {
    const key = `${namespace}:${hash}`;
    const existing = this.inMemoryStore.get(key);

    if (existing) {
      existing.count += 1;
    } else {
      this.inMemoryStore.set(key, {
        hash,
        seenAt: new Date(),
        count: 1,
      });
    }
  }

  clearExpiredEntries(maxAgeMs: number): void {
    const now = Date.now();
    for (const [key, entry] of this.inMemoryStore.entries()) {
      if (now - entry.seenAt.getTime() > maxAgeMs) {
        this.inMemoryStore.delete(key);
      }
    }
  }

  getStats(): { totalEntries: number; namespaces: string[] } {
    const namespaces = new Set<string>();
    for (const key of this.inMemoryStore.keys()) {
      const parts = key.split(':');
      if (parts.length > 0 && parts[0]) {
        namespaces.add(parts[0]);
      }
    }

    return {
      totalEntries: this.inMemoryStore.size,
      namespaces: Array.from(namespaces),
    };
  }
}
