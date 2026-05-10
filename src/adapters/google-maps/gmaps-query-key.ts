import { createHash } from 'crypto';

/** Stable 16-hex query identifier for cursor tracking. */
export function queryKey(keyword: string, industry: string, location: string): string {
  return createHash('sha256')
    .update(`${keyword}|${industry}|${location}`)
    .digest('hex')
    .slice(0, 16);
}
