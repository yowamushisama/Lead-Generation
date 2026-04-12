import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { PrismaRepositoryClient } from './prisma-repository.types';

@Injectable()
export class LeadRepository {
  constructor(private readonly prisma: PrismaService) {}

  create<T extends Prisma.LeadCreateArgs>(
    args: Prisma.SelectSubset<T, Prisma.LeadCreateArgs>,
    client: PrismaRepositoryClient = this.prisma,
  ) {
    return client.lead.create(args);
  }

  findMany<T extends Prisma.LeadFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.LeadFindManyArgs>,
    client: PrismaRepositoryClient = this.prisma,
  ) {
    return client.lead.findMany(args);
  }

  findFirst<T extends Prisma.LeadFindFirstArgs>(
    args: Prisma.SelectSubset<T, Prisma.LeadFindFirstArgs>,
    client: PrismaRepositoryClient = this.prisma,
  ) {
    return client.lead.findFirst(args);
  }

  findUnique<T extends Prisma.LeadFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.LeadFindUniqueArgs>,
    client: PrismaRepositoryClient = this.prisma,
  ) {
    return client.lead.findUnique(args);
  }

  update<T extends Prisma.LeadUpdateArgs>(
    args: Prisma.SelectSubset<T, Prisma.LeadUpdateArgs>,
    client: PrismaRepositoryClient = this.prisma,
  ) {
    return client.lead.update(args);
  }

  updateMany<T extends Prisma.LeadUpdateManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.LeadUpdateManyArgs>,
    client: PrismaRepositoryClient = this.prisma,
  ) {
    return client.lead.updateMany(args);
  }

  delete<T extends Prisma.LeadDeleteArgs>(
    args: Prisma.SelectSubset<T, Prisma.LeadDeleteArgs>,
    client: PrismaRepositoryClient = this.prisma,
  ) {
    return client.lead.delete(args);
  }

  count<T extends Prisma.LeadCountArgs>(
    args: Prisma.SelectSubset<T, Prisma.LeadCountArgs>,
    client: PrismaRepositoryClient = this.prisma,
  ) {
    return client.lead.count(args);
  }

  aggregate<T extends Prisma.LeadAggregateArgs>(
    args: Prisma.SelectSubset<T, Prisma.LeadAggregateArgs>,
    client: PrismaRepositoryClient = this.prisma,
  ) {
    return client.lead.aggregate(args);
  }

  countByStatus(where: Prisma.LeadWhereInput, client: PrismaRepositoryClient = this.prisma) {
    return client.lead.groupBy({
      by: ['status'],
      where,
      _count: { id: true },
    });
  }

  countByTier(where: Prisma.LeadWhereInput, client: PrismaRepositoryClient = this.prisma) {
    return client.lead.groupBy({
      by: ['tier'],
      where,
      _count: { id: true },
    });
  }

  countBySource(where: Prisma.LeadWhereInput, client: PrismaRepositoryClient = this.prisma) {
    return client.lead.groupBy({
      by: ['source'],
      where,
      _count: { id: true },
    });
  }

  countByCampaignAndStatus(
    where: Prisma.LeadWhereInput,
    client: PrismaRepositoryClient = this.prisma,
  ) {
    return client.lead.groupBy({
      by: ['campaignId', 'status'],
      where,
      _count: { id: true },
    });
  }
}
