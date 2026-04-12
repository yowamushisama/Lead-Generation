import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { PrismaRepositoryClient } from './prisma-repository.types';

@Injectable()
export class UsageRecordRepository {
  constructor(private readonly prisma: PrismaService) {}

  findUnique<T extends Prisma.UsageRecordFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.UsageRecordFindUniqueArgs>,
    client: PrismaRepositoryClient = this.prisma,
  ) {
    return client.usageRecord.findUnique(args);
  }

  findMany<T extends Prisma.UsageRecordFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.UsageRecordFindManyArgs>,
    client: PrismaRepositoryClient = this.prisma,
  ) {
    return client.usageRecord.findMany(args);
  }

  findFirst<T extends Prisma.UsageRecordFindFirstArgs>(
    args: Prisma.SelectSubset<T, Prisma.UsageRecordFindFirstArgs>,
    client: PrismaRepositoryClient = this.prisma,
  ) {
    return client.usageRecord.findFirst(args);
  }

  upsert<T extends Prisma.UsageRecordUpsertArgs>(
    args: Prisma.SelectSubset<T, Prisma.UsageRecordUpsertArgs>,
    client: PrismaRepositoryClient = this.prisma,
  ) {
    return client.usageRecord.upsert(args);
  }
}
