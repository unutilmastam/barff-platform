import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { HealthIndicatorService, type HealthIndicatorResult } from '@nestjs/terminus';
import Redis from 'ioredis';
import { AppConfigService } from '../../common/config/app-config.service.js';

/**
 * Readiness probe for Redis.
 *
 * Redis is not decorative here: from S04 it holds refresh-token revocation, and
 * from S11 the public-content cache. If it is unreachable, the instance is not
 * ready to serve.
 */
@Injectable()
export class RedisHealthIndicator implements OnModuleDestroy {
  private client: Redis | undefined;

  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    private readonly config: AppConfigService,
  ) {}

  private getClient(): Redis {
    this.client ??= new Redis(this.config.redisUrl, {
      // Probe semantics: report the failure, do not queue commands waiting for
      // a recovery that may never come.
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      connectTimeout: 3000,
      retryStrategy: () => null,
    });
    return this.client;
  }

  async isHealthy(key = 'redis'): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);
    const startedAt = Date.now();
    const client = this.getClient();

    try {
      if (client.status !== 'ready') {
        await client.connect();
      }
      const pong = await client.ping();
      if (pong !== 'PONG') {
        return indicator.down({ message: `Unexpected PING reply: ${pong}` });
      }
      return indicator.up({ responseTimeMs: Date.now() - startedAt });
    } catch (error) {
      // A failed connect leaves the client in an end state; drop it so the next
      // probe builds a fresh one instead of reporting a stale failure forever.
      this.client?.disconnect();
      this.client = undefined;
      return indicator.down({
        responseTimeMs: Date.now() - startedAt,
        message: error instanceof Error ? error.message : 'Unknown redis error',
      });
    }
  }

  onModuleDestroy(): void {
    this.client?.disconnect();
    this.client = undefined;
  }
}
