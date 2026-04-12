import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { PrismaRepositoryClient } from './prisma-repository.types';

@Injectable()
export class IcpProfileRepository {
  constructor(private readonly prisma: PrismaService) {}

  create<T extends Prisma.ICPProfileCreateArgs>(
    args: Prisma.SelectSubset<T, Prisma.ICPProfileCreateArgs>,
    client: PrismaRepositoryClient = this.prisma,
  ) {
    return client.iCPProfile.create(args);
  }

  findMany<T extends Prisma.ICPProfileFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.ICPProfileFindManyArgs>,
    client: PrismaRepositoryClient = this.prisma,
  ) {
    return client.iCPProfile.findMany(args);
  }

  findFirst<T extends Prisma.ICPProfileFindFirstArgs>(
    args: Prisma.SelectSubset<T, Prisma.ICPProfileFindFirstArgs>,
    client: PrismaRepositoryClient = this.prisma,
  ) {
    return client.iCPProfile.findFirst(args);
  }

  findUnique<T extends Prisma.ICPProfileFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.ICPProfileFindUniqueArgs>,
    client: PrismaRepositoryClient = this.prisma,
  ) {
    return client.iCPProfile.findUnique(args);
  }

  update<T extends Prisma.ICPProfileUpdateArgs>(
    args: Prisma.SelectSubset<T, Prisma.ICPProfileUpdateArgs>,
    client: PrismaRepositoryClient = this.prisma,
  ) {
    return client.iCPProfile.update(args);
  }
}
