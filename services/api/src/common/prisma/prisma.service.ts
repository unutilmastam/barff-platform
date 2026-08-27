import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * The application's database handle.
 *
 * Connects on module init to warm the pool, and disconnects on shutdown so ECS
 * can drain a task without leaving connections open on RDS.
 * `enableShutdownHooks()` in `bootstrap.ts` is what makes `onModuleDestroy`
 * actually run on SIGTERM.
 *
 * A failed connection at boot is logged, **not** thrown. The two cases are
 * different in kind:
 *
 * - a malformed `DATABASE_URL` is a configuration error, and the Zod env schema
 *   already refuses to start the process for it;
 * - an unreachable database is an operational condition. Crashing here would
 *   turn a brief RDS blip during a deploy into every task failing to start —
 *   a total outage instead of a degraded one. Readiness reports `down`, the
 *   load balancer stops routing, and Prisma reconnects on the next query.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      // Prisma's own logs are routed through the structured logger rather than
      // printed raw, so every line stays one JSON object with a request id.
      log: [
        { emit: 'event', level: 'warn' },
        { emit: 'event', level: 'error' },
      ],
      errorFormat: 'minimal',
    });
  }

  async onModuleInit(): Promise<void> {
    // `$on` is typed against the log config above; the cast keeps that local
    // rather than widening the client's type everywhere.
    (this as unknown as { $on: (event: string, cb: (e: { message: string }) => void) => void }).$on(
      'warn',
      (event) => this.logger.warn(event.message),
    );
    (this as unknown as { $on: (event: string, cb: (e: { message: string }) => void) => void }).$on(
      'error',
      (event) => this.logger.error(event.message),
    );

    try {
      await this.$connect();
      this.logger.log('Database connection established');
    } catch (error) {
      // Deliberately swallowed — see the class comment. The readiness probe is
      // what tells the orchestrator this instance cannot serve yet.
      this.logger.error(
        'Database unreachable at startup; readiness will report down until it recovers',
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.$disconnect();
      this.logger.log('Database connection closed');
    } catch (error) {
      // Shutdown must not hang or throw; the process is going away regardless.
      this.logger.warn(
        `Error while closing the database connection: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  /**
   * Cheap round-trip for the readiness probe.
   *
   * A real query, not a connection check: a socket that opens but cannot
   * authenticate or reach the database is exactly what readiness is for.
   */
  async ping(): Promise<void> {
    await this.$queryRaw`SELECT 1`;
  }
}
