import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import * as fs from 'fs';
import * as path from 'path';
import * as childProcess from 'child_process';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../database/redis.service';

const PROFILE_LOCK_KEY = 'linkedin:profile:lock';
const PROFILE_LOCK_TTL = 30 * 60; // 30 minutes max hold

@Injectable()
export class LinkedInVerifyJob {
  private readonly logger = new Logger(LinkedInVerifyJob.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly redis: RedisService,
  ) {}

  @Cron('0 9 * * *')
  async run(): Promise<void> {
    const keywords = this.configService.get<string>('LINKEDIN_VERIFY_KEYWORDS');
    if (!keywords) {
      this.logger.log('LINKEDIN_VERIFY_KEYWORDS not set — skipping nightly selector verify');
      return;
    }

    // Acquire profile lock — bail if scrape is still running
    const existing = await this.redis.get(PROFILE_LOCK_KEY);
    if (existing) {
      this.logger.warn({
        message: 'LinkedIn profile locked — scrape still running, skipping verify',
        lock: existing,
      });
      return;
    }

    await this.redis.set(PROFILE_LOCK_KEY, `verify:${new Date().toISOString()}`, PROFILE_LOCK_TTL);

    try {
      this.logger.log('LinkedIn selector verify started');
      await this.runVerifyScript();
      this.logger.log('LinkedIn selector verify complete');
    } finally {
      await this.redis.set(PROFILE_LOCK_KEY, '', 1).catch(() => {});
    }
  }

  private runVerifyScript(): Promise<void> {
    return new Promise((resolve, reject) => {
      const scriptPath = path.join(process.cwd(), 'dist', 'scripts', 'verify-linkedin-selectors.js');

      if (!fs.existsSync(scriptPath)) {
        this.logger.warn(`Verify script not found at ${scriptPath} — run "npm run build" first`);
        resolve();
        return;
      }

      const child = childProcess.spawn(process.execPath, [scriptPath], {
        env: process.env,
        stdio: 'inherit',
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          this.logger.error({
            message: 'LinkedIn selector verify failed — selectors may have drifted',
            exitCode: code,
          });
          resolve(); // Don't throw — just log; Claude trigger will read the report file
        }
      });

      child.on('error', reject);
    });
  }
}
