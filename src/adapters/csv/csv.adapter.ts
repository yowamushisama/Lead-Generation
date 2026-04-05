import { Injectable, BadRequestException } from '@nestjs/common';
import { createReadStream } from 'fs';
import { parse } from 'csv-parse';
import { BaseAdapter } from '../base.adapter';
import { AdapterConfig } from '../../common/interfaces/adapter.interface';
import { RawLeadInput } from '../../common/interfaces/lead-input.interface';
import { LeadSource } from '../../common/enums/lead-source.enum';

interface CsvRow {
  name?: string;
  full_name?: string;
  email?: string;
  phone?: string;
  company?: string;
  organization?: string;
  role?: string;
  title?: string;
  job_title?: string;
  industry?: string;
  location?: string;
  city?: string;
  website?: string;
  linkedin?: string;
  bio?: string;
  headline?: string;
  [key: string]: string | undefined;
}

@Injectable()
export class CsvAdapter extends BaseAdapter {
  readonly name = LeadSource.CSV_IMPORT;
  readonly sourceType = 'discovery' as const;

  async isHealthy(): Promise<boolean> {
    return true;
  }

  async *collect(config: AdapterConfig): AsyncGenerator<RawLeadInput> {
    this.validateConfig(config);

    if (!config.filePath) {
      throw new BadRequestException('CSV adapter requires filePath in config');
    }

    this.log(`Starting CSV import from: ${config.filePath}`, {
      organizationId: config.organizationId,
    });

    let rowCount = 0;
    let validCount = 0;

    const parser = createReadStream(config.filePath).pipe(
      parse({
        columns: true,
        skip_empty_lines: true,
        trim: true,
        cast: true,
      }),
    );

    for await (const row of parser) {
      rowCount++;
      const csvRow = row as CsvRow;

      const lead = this.mapRowToLead(csvRow, config);
      if (lead) {
        validCount++;
        yield lead;
      }

      if (config.maxResults && validCount >= config.maxResults) {
        this.log(`Reached maxResults limit: ${config.maxResults}`, {
          organizationId: config.organizationId,
        });
        break;
      }
    }

    this.log(`CSV import complete: ${validCount}/${rowCount} valid rows`, {
      organizationId: config.organizationId,
    });
  }

  private mapRowToLead(row: CsvRow, config: AdapterConfig): RawLeadInput | null {
    const name = row.name ?? row.full_name;

    if (!name || name.trim() === '') {
      this.logWarn('Skipping row: missing name field', { row: JSON.stringify(row) });
      return null;
    }

    return {
      externalId: row.email ?? undefined,
      source: LeadSource.CSV_IMPORT,
      sourceType: 'discovery',
      name: name.trim(),
      email: row.email?.trim(),
      phone: row.phone?.trim(),
      company: (row.company ?? row.organization)?.trim(),
      role: (row.role ?? row.title ?? row.job_title)?.trim(),
      industry: row.industry?.trim(),
      location: (row.location ?? row.city)?.trim(),
      website: (row.website ?? row.linkedin)?.trim(),
      headline: row.headline?.trim(),
      bio: row.bio?.trim(),
      originalContent: JSON.stringify(row),
      metadata: {
        campaignId: config.campaignId,
        importedAt: new Date().toISOString(),
      },
    };
  }
}
