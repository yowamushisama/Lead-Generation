import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { PrismaRepositoryClient } from './prisma-repository.types';

@Injectable()
export class OrganizationRepository {
  constructor(private readonly prisma: PrismaService) {}

  create<T extends Prisma.OrganizationCreateArgs>(
    args: Prisma.SelectSubset<T, Prisma.OrganizationCreateArgs>,
    client: PrismaRepositoryClient = this.prisma,
  ) {
    return client.organization.create(args);
  }

  findMany<T extends Prisma.OrganizationFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.OrganizationFindManyArgs>,
    client: PrismaRepositoryClient = this.prisma,
  ) {
    return client.organization.findMany(args);
  }

  findUnique<T extends Prisma.OrganizationFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.OrganizationFindUniqueArgs>,
    client: PrismaRepositoryClient = this.prisma,
  ) {
    return client.organization.findUnique(args);
  }

  findFirst<T extends Prisma.OrganizationFindFirstArgs>(
    args: Prisma.SelectSubset<T, Prisma.OrganizationFindFirstArgs>,
    client: PrismaRepositoryClient = this.prisma,
  ) {
    return client.organization.findFirst(args);
  }

  count<T extends Prisma.OrganizationCountArgs>(
    args: Prisma.SelectSubset<T, Prisma.OrganizationCountArgs>,
    client: PrismaRepositoryClient = this.prisma,
  ) {
    return client.organization.count(args);
  }

  update<T extends Prisma.OrganizationUpdateArgs>(
    args: Prisma.SelectSubset<T, Prisma.OrganizationUpdateArgs>,
    client: PrismaRepositoryClient = this.prisma,
  ) {
    return client.organization.update(args);
  }
}
