import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { PrismaRepositoryClient } from './prisma-repository.types';

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  create<T extends Prisma.UserCreateArgs>(
    args: Prisma.SelectSubset<T, Prisma.UserCreateArgs>,
    client: PrismaRepositoryClient = this.prisma,
  ) {
    return client.user.create(args);
  }

  findUnique<T extends Prisma.UserFindUniqueArgs>(
    args: Prisma.SelectSubset<T, Prisma.UserFindUniqueArgs>,
    client: PrismaRepositoryClient = this.prisma,
  ) {
    return client.user.findUnique(args);
  }
}
