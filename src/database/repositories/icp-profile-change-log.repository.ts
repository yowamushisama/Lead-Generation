import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { ICPChangeLogEntry } from '../../icp/icp-change-log.types';

export { ICPChangeLogEntry };

@Injectable()
export class IcpProfileChangeLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createMany(
    tx: Prisma.TransactionClient | PrismaService,
    entries: ICPChangeLogEntry[],
  ): Promise<void> {
    if (entries.length === 0) return;
    const client = (tx as any).iCPProfileChangeLog ? tx : this.prisma;
    await (client as any).iCPProfileChangeLog.createMany({
      data: entries.map((e) => ({
        id: crypto.randomUUID(),
        profileId: e.profileId,
        organizationId: e.organizationId,
        changedBy: e.changedBy ?? null,
        fieldName: e.fieldName,
        beforeValue: e.beforeValue === undefined ? Prisma.JsonNull : (e.beforeValue as Prisma.InputJsonValue),
        afterValue: e.afterValue === undefined ? Prisma.JsonNull : (e.afterValue as Prisma.InputJsonValue),
        fromVersion: e.fromVersion,
        toVersion: e.toVersion,
      })),
    });
  }

  async findByProfile(profileId: string, limit = 50) {
    return this.prisma.iCPProfileChangeLog.findMany({
      where: { profileId },
      orderBy: { changedAt: 'desc' },
      take: limit,
    });
  }
}
