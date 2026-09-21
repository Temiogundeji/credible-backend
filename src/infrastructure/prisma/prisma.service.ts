import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { AsyncLocalStorage } from 'node:async_hooks';
import { IdentityTransaction } from '../../modules/identity/domain/identity-ports';

type PrismaExecutor = PrismaClient | Prisma.TransactionClient;

const transactionStorage = new AsyncLocalStorage<Prisma.TransactionClient>();

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  currentExecutor(): PrismaExecutor {
    return transactionStorage.getStore() ?? this;
  }

  async runInTransaction<T>(operation: () => Promise<T>): Promise<T> {
    if (transactionStorage.getStore()) return operation();

    return this.$transaction(async (transactionClient) =>
      transactionStorage.run(transactionClient, operation),
    );
  }
}

@Injectable()
export class PrismaIdentityTransaction implements IdentityTransaction {
  constructor(private readonly prisma: PrismaService) {}

  run<T>(operation: () => Promise<T>): Promise<T> {
    return this.prisma.runInTransaction(operation);
  }
}
