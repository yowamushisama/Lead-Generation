import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { PrismaRepositoryClient } from './prisma-repository.types';

@Injectable()
export class MessageRepository {
  constructor(private readonly prisma: PrismaService) {}

  create<T extends Prisma.MessageCreateArgs>(
    args: Prisma.SelectSubset<T, Prisma.MessageCreateArgs>,
    client: PrismaRepositoryClient = this.prisma,
  ) {
    return client.message.create(args);
  }

  findMany<T extends Prisma.MessageFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.MessageFindManyArgs>,
    client: PrismaRepositoryClient = this.prisma,
  ) {
    return client.message.findMany(args);
  }

  findFirst<T extends Prisma.MessageFindFirstArgs>(
    args: Prisma.SelectSubset<T, Prisma.MessageFindFirstArgs>,
    client: PrismaRepositoryClient = this.prisma,
  ) {
    return client.message.findFirst(args);
  }

  update<T extends Prisma.MessageUpdateArgs>(
    args: Prisma.SelectSubset<T, Prisma.MessageUpdateArgs>,
    client: PrismaRepositoryClient = this.prisma,
  ) {
    return client.message.update(args);
  }

  updateMany<T extends Prisma.MessageUpdateManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.MessageUpdateManyArgs>,
    client: PrismaRepositoryClient = this.prisma,
  ) {
    return client.message.updateMany(args);
  }

  count<T extends Prisma.MessageCountArgs>(
    args: Prisma.SelectSubset<T, Prisma.MessageCountArgs>,
    client: PrismaRepositoryClient = this.prisma,
  ) {
    return client.message.count(args);
  }

  countByStatus(where: Prisma.MessageWhereInput, client: PrismaRepositoryClient = this.prisma) {
    return client.message.groupBy({
      by: ['status'],
      where,
      _count: { id: true },
    });
  }
}
