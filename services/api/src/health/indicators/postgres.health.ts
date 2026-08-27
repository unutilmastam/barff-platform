import { Injectable } from '@nestjs/common';
import { HealthIndicatorService, type HealthIndicatorResult } from '@nestjs/terminus';
import { PrismaService } from '../../common/prisma/prisma.service.js';

/**
 * Readiness probe for PostgreSQL.
 *
 * Uses the application's own Prisma connection pool rather than a second one:
 * a probe that opens its own connection can report "up" while the pool the
 * requests actually use is exhausted — which is precisely the outage readiness
 * is supposed to catch.
 *
 * (S02 used a one-connection `pg` pool as a placeholder until Prisma existed.
 * `pg` has been removed from the dependency list.)
 */
@Injectable()
export class PostgresHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly prisma: PrismaService,
  ) {}

  async isHealthy(key = 'database'): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);
    const startedAt = Date.now();

    try {
      await this.prisma.ping();
      return indicator.up({ responseTimeMs: Date.now() - startedAt });
    } catch (error) {
      // The message can name a host or database — fine for an operator reading
      // a probe, and /health is not exposed publicly through Cloudflare.
      return indicator.down({
        responseTimeMs: Date.now() - startedAt,
        message: error instanceof Error ? error.message : 'Unknown database error',
      });
    }
  }
}
