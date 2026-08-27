import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

/**
 * Global so feature modules inject `PrismaService` without importing this
 * module each time. Repositories still live in their feature module —
 * controllers must never talk to Prisma directly (CLAUDE.md §11).
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
