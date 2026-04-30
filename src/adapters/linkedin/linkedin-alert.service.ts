import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { AppLogger } from '../../common/utils/logger.util';

export type AlertKind = 'drift' | 'checkpoint' | 'zero-leads' | 'rate-limit';

export interface AlertPayload {
  keyword?: string;
  url?: string;
  email?: string;
  organizationId?: string;
  runId?: string;
  reason?: string;
  [key: string]: unknown;
}

@Injectable()
export class LinkedInAlertService {
  private readonly logger = new AppLogger(LinkedInAlertService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('SMTP_HOST');
    const user = this.configService.get<string>('SMTP_USER');
    if (host && user) {
      this.transporter = nodemailer.createTransport({
        host,
        port: this.configService.get<number>('SMTP_PORT') ?? 587,
        secure: false,
        auth: {
          user,
          pass: this.configService.get<string>('SMTP_PASS') ?? '',
        },
      });
    }
  }

  async emit(kind: AlertKind, payload: AlertPayload): Promise<void> {
    this.logger.error({
      message: `LinkedIn alert: ${kind}`,
      module: 'linkedin',
      kind,
      ...payload,
    });

    const to = this.configService.get<string>('LINKEDIN_ALERT_EMAIL_TO');
    if (!to || !this.transporter) return;

    const from =
      this.configService.get<string>('LINKEDIN_ALERT_EMAIL_FROM') ??
      this.configService.get<string>('SMTP_USER') ??
      'no-reply@localhost';

    const subject = `[LinkedIn Scraper] ${kind.toUpperCase()} alert`;
    const text = this.buildEmailBody(kind, payload);

    try {
      await this.transporter.sendMail({ from, to, subject, text });
    } catch (err) {
      this.logger.error({
        message: 'Failed to send LinkedIn alert email',
        module: 'linkedin',
        kind,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private buildEmailBody(kind: AlertKind, payload: AlertPayload): string {
    const lines = [
      `Alert type : ${kind}`,
      `Timestamp  : ${new Date().toISOString()}`,
    ];
    if (payload.organizationId) lines.push(`Org        : ${payload.organizationId}`);
    if (payload.runId) lines.push(`Run ID     : ${payload.runId}`);
    if (payload.keyword) lines.push(`Keyword    : ${payload.keyword}`);
    if (payload.url) lines.push(`URL        : ${payload.url}`);
    if (payload.reason) lines.push(`Reason     : ${payload.reason}`);

    const extra = Object.entries(payload).filter(
      ([k]) => !['organizationId', 'runId', 'keyword', 'url', 'reason', 'email'].includes(k),
    );
    for (const [k, v] of extra) {
      lines.push(`${k.padEnd(10)} : ${JSON.stringify(v)}`);
    }
    return lines.join('\n');
  }
}
