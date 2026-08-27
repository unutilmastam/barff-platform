import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { HealthIndicatorService, type HealthIndicatorResult } from '@nestjs/terminus';
import { Pool } from 'pg';
import { AppConfigService } from '../../common/config/app-config.service.js';

/**
 * Readiness probe for PostgreSQL.
 *
 * A real round-trip (`SELECT 1`), not a TCP connect: a socket that opens but
 * cannot authenticate or reach the database is exactly the failure a readiness
 * probe exists to catch.
 *
 * The pool is tiny and short-timeout on purpose — this connection exists to
 * answer a probe, not to serve traffic. From S03 the application talks to
 * Postgres through Prisma, and this indicator moves to `prisma.$queryRaw`;
 * `pg` then leaves the dependency list.
 */
@Injectable()
export class PostgresHealthIndicator implements OnModuleDestroy {
  private pool: Pool | undefined;

  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly config: AppConfigService,
  ) {}

  private getPool(): Pool {
    this.pool ??= new Pool({
      connectionString: this.config.databaseUrl,
      max: 1,
      // Fail the probe rather than let a hung connection hold the event loop.
      connectionTimeoutMillis: 3000,
      idleTimeoutMillis: 10_000,
      allowExitOnIdle: true,
    });
    return this.pool;
  }

  async isHealthy(key = 'database'): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);
    const startedAt = Date.now();

    try {
      await this.getPool().query('SELECT 1');
      return indicator.up({ responseTimeMs: Date.now() - startedAt });
    } catch (error) {
      // The message can name a host or a database — fine for an operator
      // reading a probe, and it is never returned to a public client because
      // /health is not exposed through Cloudflare.
      return indicator.down({
        responseTimeMs: Date.now() - startedAt,
        message: error instanceof Error ? error.message : 'Unknown database error',
      });
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
    this.pool = undefined;
  }
}
