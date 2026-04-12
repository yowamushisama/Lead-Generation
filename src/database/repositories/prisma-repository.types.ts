import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';

export type PrismaRepositoryClient = PrismaService | Prisma.TransactionClient;
