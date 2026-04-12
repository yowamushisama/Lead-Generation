import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { PrismaRepositoryClient } from './prisma-repository.types';

@Injectable()
export class ConversationRepository {
  constructor(private readonly prisma: PrismaService) {}

  create<T extends Prisma.ConversationCreateArgs>(
    args: Prisma.SelectSubset<T, Prisma.ConversationCreateArgs>,
    client: PrismaRepositoryClient = this.prisma,
  ) {
    return client.conversation.create(args);
  }

  findMany<T extends Prisma.ConversationFindManyArgs>(
    args: Prisma.SelectSubset<T, Prisma.ConversationFindManyArgs>,
    client: PrismaRepositoryClient = this.prisma,
  ) {
    return client.conversation.findMany(args);
  }

  findFirst<T extends Prisma.ConversationFindFirstArgs>(
    args: Prisma.SelectSubset<T, Prisma.ConversationFindFirstArgs>,
    client: PrismaRepositoryClient = this.prisma,
  ) {
    return client.conversation.findFirst(args);
  }

  update<T extends Prisma.ConversationUpdateArgs>(
    args: Prisma.SelectSubset<T, Prisma.ConversationUpdateArgs>,
    client: PrismaRepositoryClient = this.prisma,
  ) {
    return client.conversation.update(args);
  }
}
