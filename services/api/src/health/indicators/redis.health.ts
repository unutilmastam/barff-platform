import { Injectable } from '@nestjs/common';
import { HealthIndicatorService, type HealthIndicatorResult } from '@nestjs/terminus';
import { RedisService } from '../../common/redis/redis.service.js';

/**
 * Readiness probe for Redis.
 *
 * Uses the application's own client rather than a private one: from S04 Redis
 * holds refresh-token state, so a probe that succeeds on a separate connection
 * while the shared one is broken would report ready during an outage that
 * actually breaks every login.
 */
@Injectable()
export class RedisHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly redis: RedisService,
  ) {}

  async isHealthy(key = 'redis'): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);
    const startedAt = Date.now();

    try {
      const pong = await this.redis.ping();
      if (pong !== 'PONG') {
        return indicator.down({ message: `Unexpected PING reply: ${pong}` });
      }
      return indicator.up({ responseTimeMs: Date.now() - startedAt });
    } catch (error) {
      // A failed connect leaves ioredis in an end state; drop it so the next
      // probe builds a fresh client instead of repeating a stale failure.
      this.redis.reset();
      return indicator.down({
        responseTimeMs: Date.now() - startedAt,
        message: error instanceof Error ? error.message : 'Unknown redis error',
      });
    }
  }
}
