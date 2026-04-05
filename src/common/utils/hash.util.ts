import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';

@Injectable()
export class HashUtil {
  sha256(input: string): string {
    return createHash('sha256').update(input, 'utf8').digest('hex');
  }

  sha512(input: string): string {
    return createHash('sha512').update(input, 'utf8').digest('hex');
  }

  md5(input: string): string {
    return createHash('md5').update(input, 'utf8').digest('hex');
  }

  generateSecureToken(bytes: number = 32): string {
    return randomBytes(bytes).toString('hex');
  }

  generateApiKey(): string {
    const prefix = 'lge';
    const token = randomBytes(24).toString('base64url');
    return `${prefix}_${token}`;
  }

  compareHashes(hash1: string, hash2: string): boolean {
    if (hash1.length !== hash2.length) return false;

    let result = 0;
    for (let i = 0; i < hash1.length; i++) {
      result |= hash1.charCodeAt(i) ^ hash2.charCodeAt(i);
    }
    return result === 0;
  }

  hashObject(obj: Record<string, unknown>): string {
    const sorted = JSON.stringify(obj, Object.keys(obj).sort());
    return this.sha256(sorted);
  }
}
