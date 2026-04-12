import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { PrismaRepositoryClient } from './prisma-repository.types';

@Injectable()
export class AnalyticsEventRepository {
  constructor(private readonly prisma: PrismaService) {}

  create<T extends Parameters<PrismaService['analyticsEvent']['create']>[0]>(
    args: T,
    client: PrismaRepositoryClient = this.prisma,
  ) {
    return client.analyticsEvent.create(args);
  }
}
