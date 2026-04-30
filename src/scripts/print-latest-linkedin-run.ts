/**
 * Prints the most recent LinkedInRun row from the database as JSON.
 * Used by the scheduled Claude Code trigger to read run health without
 * needing Prisma Studio or a live API endpoint.
 *
 * Usage:
 *   node dist/scripts/print-latest-linkedin-run.js
 *   node dist/scripts/print-latest-linkedin-run.js --org-id <uuid>
 */

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { LinkedInRunRepository } from '../database/repositories/linkedin-run.repository';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env.local', '.env'], cache: true })],
  providers: [PrismaService, LinkedInRunRepository],
})
class PrintRunModule {}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const orgIdx = args.indexOf('--org-id');
  const orgId = orgIdx >= 0 ? args[orgIdx + 1] : undefined;

  const app = await NestFactory.createApplicationContext(PrintRunModule, { logger: false });
  const repo = app.get(LinkedInRunRepository);

  try {
    const run = orgId
      ? await repo.findLatest(orgId)
      : await repo.findRecent(1).then((rows: unknown[]) => rows[0] ?? null);
    if (!run) {
      console.log(JSON.stringify({ error: 'no run found' }));
      process.exit(0);
    }
    console.log(JSON.stringify(run, null, 2));
  } finally {
    await app.close();
  }
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
