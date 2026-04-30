import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';

export interface LinkedInRunCreateInput {
  runId: string;
  organizationId: string;
  campaignId?: string;
  startedAt: Date;
  completedAt?: Date;
  durationMs: number;
  totalYielded: number;
  extractionRate: number;
  rateLimitRate: number;
  healthy: boolean;
  healthReason?: string;
  selectorVersion: number;
  perKeyword: Prisma.InputJsonValue;
  errors: Prisma.InputJsonValue;
}

@Injectable()
export class LinkedInRunRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: LinkedInRunCreateInput) {
    return this.prisma.linkedInRun.create({ data });
  }

  findRecent(days: number, organizationId?: string) {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    return this.prisma.linkedInRun.findMany({
      where: {
        startedAt: { gte: since },
        ...(organizationId ? { organizationId } : {}),
      },
      orderBy: { startedAt: 'desc' },
    });
  }

  findLatest(organizationId: string) {
    return this.prisma.linkedInRun.findFirst({
      where: { organizationId },
      orderBy: { startedAt: 'desc' },
    });
  }
}
