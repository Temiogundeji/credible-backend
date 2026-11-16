import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { softDeleteMiddleware } from './middleware/soft-delete.middleware';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    // Register the soft‑delete middleware globally
    this.$use(softDeleteMiddleware());
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
