import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { AppConfigService } from '../config/app-config.service.js';

/**
 * The application's single Redis connection.
 *
 * S02 had the health indicator build its own client. That was fine while Redis
 * only served a probe, but auth now depends on it for refresh-token storage —
 * and a probe holding a *different* connection can report "up" while the one
 * serving requests is broken. One client, shared.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | undefined;

  constructor(private readonly config: AppConfigService) {}

  /**
   * Lazily connected so an unreachable Redis does not stop the process
   * starting — the same reasoning as `PrismaService`: a brief ElastiCache blip
   * during a deploy must degrade readiness, not kill every task.
   */
  getClient(): Redis {
    this.client ??= new Redis(this.config.redisUrl, {
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 2,
      connectTimeout: 3000,
    });
    return this.client;
  }

  private async ensureConnected(): Promise<Redis> {
    const client = this.getClient();
    if (client.status !== 'ready' && client.status !== 'connecting') {
      await client.connect().catch(() => {
        // Surfaced by the caller's own error handling; the readiness probe is
        // what reports the outage.
      });
    }
    return client;
  }

  async ping(): Promise<string> {
    const client = await this.ensureConnected();
    return client.ping();
  }

  async get(key: string): Promise<string | null> {
    return (await this.ensureConnected()).get(key);
  }

  /** Sets a key with a mandatory TTL — nothing auth writes here lives forever. */
  async setEx(key: string, value: string, ttlSeconds: number): Promise<void> {
    await (await this.ensureConnected()).set(key, value, 'EX', ttlSeconds);
  }

  async del(...keys: string[]): Promise<number> {
    if (keys.length === 0) return 0;
    return (await this.ensureConnected()).del(...keys);
  }

  async sAdd(key: string, member: string, ttlSeconds: number): Promise<void> {
    const client = await this.ensureConnected();
    await client.sadd(key, member);
    await client.expire(key, ttlSeconds);
  }

  async sMembers(key: string): Promise<string[]> {
    return (await this.ensureConnected()).smembers(key);
  }

  async sRem(key: string, member: string): Promise<void> {
    await (await this.ensureConnected()).srem(key, member);
  }

  /** Reset the connection so a failed probe does not report a stale error forever. */
  reset(): void {
    this.client?.disconnect();
    this.client = undefined;
  }

  onModuleDestroy(): void {
    this.client?.disconnect();
    this.client = undefined;
    this.logger.log('Redis connection closed');
  }
}
