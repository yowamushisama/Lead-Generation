import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { HashUtil } from '../common/utils/hash.util';

interface DuplicateCheckInput {
  name: string;
  email?: string;
  company?: string;
  source: string;
  organizationId: string;
  externalId?: string;
}

interface ContentHashInput {
  name: string;
  email?: string;
  company?: string;
  source: string;
  organizationId: string;
}

@Injectable()
export class DeduplicationService {
  private readonly logger = new Logger(DeduplicationService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly hashUtil: HashUtil,
  ) {}

  async checkDuplicate(input: DuplicateCheckInput): Promise<boolean> {
    // Check by externalId + source + organizationId (strongest signal)
    if (input.externalId) {
      const byExternalId = await this.prismaService.lead.findUnique({
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
      const byEmail = await this.prismaService.lead.findFirst({
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
    const byHash = await this.prismaService.lead.findFirst({
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

    const leads = await this.prismaService.lead.findMany({
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

  async getDeduplicationStats(organizationId: string): Promise<unknown> {
    const [total, withEmail, withHash] = await Promise.all([
      this.prismaService.lead.count({ where: { organizationId } }),
      this.prismaService.lead.count({ where: { organizationId, email: { not: null } } }),
      this.prismaService.lead.count({ where: { organizationId, contentHash: { not: null } } }),
    ]);

    return {
      totalLeads: total,
      leadsWithEmail: withEmail,
      leadsWithHash: withHash,
      deduplicationCoverage: total > 0 ? Math.round((withHash / total) * 100) : 0,
    };
  }
}
