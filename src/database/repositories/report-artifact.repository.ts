import { Injectable } from '@nestjs/common';
import { Prisma, ReportArtifact } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { PrismaRepositoryClient } from './prisma-repository.types';

export type ReportArtifactKind = 'WEBSITE_REPORT';

@Injectable()
export class ReportArtifactRepository {
  constructor(private readonly prisma: PrismaService) {}

  create<T extends Prisma.ReportArtifactCreateArgs>(
    args: Prisma.SelectSubset<T, Prisma.ReportArtifactCreateArgs>,
    client: PrismaRepositoryClient = this.prisma,
  ) {
    return client.reportArtifact.create(args);
  }

  findMany<T extends Prisma.ReportArtifactFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.ReportArtifactFindManyArgs>,
    client: PrismaRepositoryClient = this.prisma,
  ) {
    return client.reportArtifact.findMany(args);
  }

  findFirst<T extends Prisma.ReportArtifactFindFirstArgs>(
    args: Prisma.SelectSubset<T, Prisma.ReportArtifactFindFirstArgs>,
    client: PrismaRepositoryClient = this.prisma,
  ) {
    return client.reportArtifact.findFirst(args);
  }

  /**
   * Returns the highest-version artifact for a given (lead, kind) pair, or null.
   */
  findLatest(
    leadId: string,
    kind: ReportArtifactKind,
    client: PrismaRepositoryClient = this.prisma,
  ) {
    return client.reportArtifact.findFirst({
      where: { leadId, kind },
      orderBy: { version: 'desc' },
    });
  }

  /**
   * Returns the next version number to assign for a (lead, kind) pair.
   * Used by generator stages to bump version on regeneration.
   */
  async getNextVersion(
    leadId: string,
    kind: ReportArtifactKind,
    client: PrismaRepositoryClient = this.prisma,
  ): Promise<number> {
    const latest = await client.reportArtifact.findFirst({
      where: { leadId, kind },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    return (latest?.version ?? 0) + 1;
  }

  findAllVersions(
    leadId: string,
    kind: ReportArtifactKind,
    client: PrismaRepositoryClient = this.prisma,
  ) {
    return client.reportArtifact.findMany({
      where: { leadId, kind },
      orderBy: { version: 'desc' },
    });
  }

  /**
   * Atomically computes the next version and creates the artifact inside a
   * transaction, retrying on unique-constraint races (@@unique [leadId, kind, version]).
   */
  async createWithAutoVersion(input: {
    organizationId: string;
    leadId: string;
    campaignId?: string | null;
    kind: ReportArtifactKind;
    body: string;
    metadata: Prisma.InputJsonValue;
  }, maxRetries = 3): Promise<ReportArtifact> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const latest = await tx.reportArtifact.findFirst({
            where: { leadId: input.leadId, kind: input.kind },
            orderBy: { version: 'desc' },
            select: { version: true },
          });
          const version = (latest?.version ?? 0) + 1;
          return tx.reportArtifact.create({
            data: {
              organizationId: input.organizationId,
              leadId: input.leadId,
              campaignId: input.campaignId ?? null,
              kind: input.kind,
              version,
              body: input.body,
              metadata: input.metadata,
            },
          });
        });
      } catch (err) {
        const isUniqueConflict =
          err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
        if (!isUniqueConflict || attempt === maxRetries) throw err;
      }
    }
    // Unreachable — loop always throws or returns.
    throw new Error('createWithAutoVersion exhausted retries');
  }
}
