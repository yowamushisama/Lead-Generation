import { Injectable } from '@nestjs/common';
import { createHmac } from 'crypto';
import { BaseAdapter } from '../base.adapter';
import { AdapterConfig } from '../../common/interfaces/adapter.interface';
import { RawLeadInput } from '../../common/interfaces/lead-input.interface';
import { LeadSource } from '../../common/enums/lead-source.enum';

export interface WebhookPayload {
  leads?: RawLeadInput[];
  lead?: RawLeadInput;
  data?: unknown;
  source?: string;
  timestamp?: string;
  signature?: string;
}

@Injectable()
export class WebhookAdapter extends BaseAdapter {
  readonly name = LeadSource.WEBHOOK;
  readonly sourceType = 'intent' as const;

  private readonly pendingPayloads: WebhookPayload[] = [];

  async isHealthy(): Promise<boolean> {
    return true;
  }

  async *collect(config: AdapterConfig): AsyncGenerator<RawLeadInput> {
    this.validateConfig(config);

    while (this.pendingPayloads.length > 0) {
      const payload = this.pendingPayloads.shift();
      if (!payload) continue;

      const leads = this.extractLeads(payload, config);

      for (const lead of leads) {
        yield lead;
      }
    }
  }

  ingestPayload(payload: WebhookPayload, webhookSecret?: string): void {
    if (webhookSecret && payload.signature) {
      if (!this.verifySignature(payload, webhookSecret)) {
        throw new Error('Invalid webhook signature');
      }
    }

    this.pendingPayloads.push(payload);

    this.log(`Webhook payload ingested`, {
      leadsCount: payload.leads?.length ?? (payload.lead ? 1 : 0),
    });
  }

  verifySignature(payload: WebhookPayload, secret: string): boolean {
    if (!payload.signature) return false;

    const { signature, ...rest } = payload;
    const body = JSON.stringify(rest);
    const expectedSignature = createHmac('sha256', secret).update(body).digest('hex');

    return `sha256=${expectedSignature}` === signature;
  }

  private extractLeads(payload: WebhookPayload, config: AdapterConfig): RawLeadInput[] {
    const leads: RawLeadInput[] = [];

    if (payload.leads && Array.isArray(payload.leads)) {
      for (const lead of payload.leads) {
        leads.push(this.enrichLead(lead, config));
      }
    } else if (payload.lead) {
      leads.push(this.enrichLead(payload.lead, config));
    } else if (payload.data) {
      const rawLead = this.mapGenericPayload(payload.data, config);
      if (rawLead) {
        leads.push(rawLead);
      }
    }

    return leads;
  }

  private enrichLead(lead: RawLeadInput, config: AdapterConfig): RawLeadInput {
    return {
      ...lead,
      source: lead.source ?? LeadSource.WEBHOOK,
      sourceType: lead.sourceType ?? 'intent',
      metadata: {
        ...lead.metadata,
        campaignId: config.campaignId,
        ingestedAt: new Date().toISOString(),
      },
    };
  }

  private mapGenericPayload(data: unknown, config: AdapterConfig): RawLeadInput | null {
    if (typeof data !== 'object' || data === null) return null;

    const record = data as Record<string, unknown>;

    const name = String(record['name'] ?? record['full_name'] ?? record['contact_name'] ?? '');
    if (!name) return null;

    return {
      source: LeadSource.WEBHOOK,
      sourceType: 'intent',
      name,
      email: record['email'] ? String(record['email']) : undefined,
      company: record['company'] ? String(record['company']) : undefined,
      role:
        (record['role'] ?? record['title']) ? String(record['role'] ?? record['title']) : undefined,
      originalContent: JSON.stringify(data),
      metadata: {
        campaignId: config.campaignId,
        ingestedAt: new Date().toISOString(),
      },
    };
  }
}
