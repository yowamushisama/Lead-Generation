import { Injectable } from '@nestjs/common';

const SPAM_PATTERNS = [
  /i hope this (email |message )?finds you well/i,
  /i came across your (profile|post)/i,
  /i noticed (you|your)/i,
  /let me know if you('re| are) interested/i,
  /would love to connect/i,
  /happy to (jump on|schedule) a call/i,
  /award.?winning/i,
  /industry.?leading/i,
  /we('ve| have) helped \d+\+? (companies|clients|businesses)/i,
  /limited (spots|availability)/i,
  /don't miss out/i,
  /this week only/i,
  /boost your productivity/i,
  /scale your business/i,
  /transform your (workflow|business)/i,
];

export interface SpamCheckResult {
  spamScore: number;
  burntPatterns: string[];
  isApproved: boolean;
  wordCount: number;
}

@Injectable()
export class AntiSpamService {
  check(messageBody: string): SpamCheckResult {
    const burntPatterns: string[] = [];

    for (const pattern of SPAM_PATTERNS) {
      if (pattern.test(messageBody)) {
        burntPatterns.push(pattern.source);
      }
    }

    const wordCount = messageBody.trim().split(/\s+/).length;
    let spamScore = burntPatterns.length * 0.15;

    // Penalize excessively long first messages
    if (wordCount > 200) spamScore += 0.3;
    else if (wordCount > 150) spamScore += 0.15;

    // Penalize too many questions
    const questionCount = (messageBody.match(/\?/g) ?? []).length;
    if (questionCount > 2) spamScore += (questionCount - 2) * 0.1;

    spamScore = Math.min(1, spamScore);

    return {
      spamScore,
      burntPatterns,
      isApproved: spamScore < 0.4 && burntPatterns.length === 0,
      wordCount,
    };
  }

  isSimilarToExisting(newMessage: string, existingMessages: string[], threshold = 0.6): boolean {
    const newWords = new Set(newMessage.toLowerCase().split(/\s+/));

    for (const existing of existingMessages) {
      const existingWords = new Set(existing.toLowerCase().split(/\s+/));
      const intersection = [...newWords].filter((w) => existingWords.has(w)).length;
      const union = new Set([...newWords, ...existingWords]).size;
      const similarity = union > 0 ? intersection / union : 0;

      if (similarity > threshold) return true;
    }

    return false;
  }
}
