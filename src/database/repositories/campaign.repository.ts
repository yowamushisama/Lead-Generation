import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { PrismaRepositoryClient } from './prisma-repository.types';

@Injectable()
export class CampaignRepository {
  constructor(private readonly prisma: PrismaService) {}

  create<T extends Prisma.CampaignCreateArgs>(
    args: Prisma.SelectSubset<T, Prisma.CampaignCreateArgs>,
    client: PrismaRepositoryClient = this.prisma,
  ) {
    return client.campaign.create(args);
  }

  findMany<T extends Prisma.CampaignFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.CampaignFindManyArgs>,
    client: PrismaRepositoryClient = this.prisma,
  ) {
    return client.campaign.findMany(args);
  }

  findFirst<T extends Prisma.CampaignFindFirstArgs>(
    args: Prisma.SelectSubset<T, Prisma.CampaignFindFirstArgs>,
    client: PrismaRepositoryClient = this.prisma,
  ) {
    return client.campaign.findFirst(args);
  }

  findUnique<T extends Prisma.CampaignFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.CampaignFindUniqueArgs>,
    client: PrismaRepositoryClient = this.prisma,
  ) {
    return client.campaign.findUnique(args);
  }

  update<T extends Prisma.CampaignUpdateArgs>(
    args: Prisma.SelectSubset<T, Prisma.CampaignUpdateArgs>,
    client: PrismaRepositoryClient = this.prisma,
  ) {
    return client.campaign.update(args);
  }
}
