import { Injectable, Logger } from '@nestjs/common';
import { LeadRepository } from '../database/repositories/lead.repository';
import { HashUtil } from '../common/utils/hash.util';

interface DuplicateCheckInput {
  name: string;
  email?: string;
  company?: string;
  phone?: string;
  address?: string;
  source: string;
  organizationId: string;
  externalId?: string;
}

interface ContentHashInput {
  name: string;
  email?: string;
  company?: string;
  phone?: string;
  address?: string;
  source: string;
  organizationId: string;
}

@Injectable()
export class DeduplicationService {
  private readonly logger = new Logger(DeduplicationService.name);

  constructor(
    private readonly leadRepository: LeadRepository,
    private readonly hashUtil: HashUtil,
  ) {}

  async checkDuplicate(input: DuplicateCheckInput): Promise<boolean> {
    // Check by externalId + source + organizationId (strongest signal)
    if (input.externalId) {
      const byExternalId = await this.leadRepository.findUnique({
        where: {
          externalId_source_organizationId: {
            externalId: input.externalId,
            source: input.source,
            organizationId: input.organizationId,
          },
        },
      });

      if (byExternalId) {
        this.logger.debug({
          message: 'Duplicate detected by externalId',
          module: 'DeduplicationService',
          organizationId: input.organizationId,
          externalId: input.externalId,
          source: input.source,
        });
        return true;
      }
    }

    // Check by email + organizationId (strong signal)
    if (input.email) {
      const byEmail = await this.leadRepository.findFirst({
        where: {
          email: input.email,
          organizationId: input.organizationId,
          optedOut: false,
        },
      });

      if (byEmail) {
        this.logger.debug({
          message: 'Duplicate detected by email',
          module: 'DeduplicationService',
          organizationId: input.organizationId,
          email: input.email,
        });
        return true;
      }
    }

    // Check by content hash (fuzzy deduplication)
    const contentHash = this.computeContentHash(input);
    const byHash = await this.leadRepository.findFirst({
      where: {
        contentHash,
        organizationId: input.organizationId,
      },
    });

    if (byHash) {
      this.logger.debug({
        message: 'Duplicate detected by content hash',
        module: 'DeduplicationService',
        organizationId: input.organizationId,
        contentHash,
      });
      return true;
    }

    return false;
  }

  computeContentHash(input: ContentHashInput): string {
    const normalized = {
      name: input.name.toLowerCase().trim(),
      email: input.email?.toLowerCase().trim() ?? '',
      company: input.company?.toLowerCase().trim() ?? '',
      phone: (input.phone ?? '').replace(/\D/g, ''),
      address: (input.address ?? '').toLowerCase().replace(/\s+/g, ' ').trim(),
      source: input.source.toLowerCase(),
      organizationId: input.organizationId,
    };

    return this.hashUtil.sha256(JSON.stringify(normalized));
  }

  async findSimilarLeads(
    organizationId: string,
    name: string,
    company?: string,
  ): Promise<unknown[]> {
    const nameParts = name.toLowerCase().split(' ');

    const leads = await this.leadRepository.findMany({
      where: {
        organizationId,
        OR: [
          { name: { contains: nameParts[0] ?? '', mode: 'insensitive' } },
          ...(company ? [{ company: { contains: company, mode: 'insensitive' as const } }] : []),
        ],
      },
      take: 10,
    });

    return leads;
  }

  async markDuplicatesInBatch(
    organizationId: string,
    leads: Array<{ name: string; email?: string; company?: string; source: string }>,
  ): Promise<boolean[]> {
    const seen = new Map<string, boolean>();
    const results: boolean[] = [];

    for (const lead of leads) {
      const hash = this.computeContentHash({ ...lead, organizationId });
      const isDuplicate = seen.has(hash);
      seen.set(hash, true);
      results.push(isDuplicate);
    }

    return results;
  }

  async getDeduplicationStats(organizationId: string): Promise<{
    totalLeads: number;
    leadsWithEmail: number;
    leadsWithHash: number;
    deduplicationCoverage: number;
  }> {
    const [total, withEmail, withHash] = await Promise.all([
      this.leadRepository.count({ where: { organizationId } }),
      this.leadRepository.count({ where: { organizationId, email: { not: null } } }),
      this.leadRepository.count({ where: { organizationId, contentHash: { not: null } } }),
    ]);

    return {
      totalLeads: total,
      leadsWithEmail: withEmail,
      leadsWithHash: withHash,
      deduplicationCoverage: total > 0 ? Math.round((withHash / total) * 100) : 0,
    };
  }
}
