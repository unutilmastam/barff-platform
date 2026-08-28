import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service.js';
import { AppConfigService } from '../config/app-config.service.js';
import { ALL_CACHE_NAMESPACES, type CacheNamespace } from './cache.constants.js';

export interface CachedResponse {
  body: unknown;
  etag: string;
}

/**
 * Fraction of the signed-URL lifetime a cached copy may consume in Redis, and
 * the further fraction a browser may hold it for.
 *
 * These exist because of a failure mode that is invisible until it reaches real
 * visitors: a public product response embeds **short-lived signed media URLs**.
 * Cache the response for longer than those URLs live and the API keeps serving
 * a perfectly valid-looking payload whose every image link is dead. The bug
 * looks like broken images, so it gets investigated as a storage problem.
 *
 * The two windows are additive — a response written to Redis at t=0 can be
 * served at the end of its Redis life and then held by the browser for its full
 * `max-age` — so the sum is what has to stay inside the signing window, with
 * room to spare.
 */
const REDIS_SHARE = 0.4;
const BROWSER_SHARE = 0.2;

export interface ClampedTtl {
  redisSeconds: number;
  browserSeconds: number;
}

/**
 * Keeps a cached response strictly shorter-lived than the URLs inside it.
 *
 * Exported and unit-tested rather than inlined: it is the one piece of
 * arithmetic here that silently produces broken pages when it is wrong.
 */
export function clampToSignedUrlLifetime(
  requestedSeconds: number,
  signedUrlTtlSeconds: number,
): ClampedTtl {
  const redisSeconds = Math.max(
    1,
    Math.min(requestedSeconds, Math.floor(signedUrlTtlSeconds * REDIS_SHARE)),
  );
  const browserSeconds = Math.max(
    0,
    Math.min(Math.floor(requestedSeconds / 2), Math.floor(signedUrlTtlSeconds * BROWSER_SHARE)),
  );
  return { redisSeconds, browserSeconds };
}

/**
 * Redis cache for public responses, addressed by generation.
 *
 * Invalidation is an `INCR` on a per-namespace counter that is part of every
 * key built from it. Bumping it orphans a whole namespace in one O(1) command;
 * the orphans then expire on their own TTL. The alternatives are worse:
 * `KEYS`/`SCAN` walk the entire keyspace and block Redis while they do it, and
 * tracking every key a namespace has produced means maintaining a second index
 * that can itself drift.
 *
 * **Every method degrades to a miss.** Redis is a speed layer in front of
 * Postgres, not a dependency of correctness — an unreachable cache must slow
 * the public site down, never take it off the air.
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(
    private readonly redis: RedisService,
    private readonly config: AppConfigService,
  ) {}

  clampTtl(requestedSeconds: number): ClampedTtl {
    return clampToSignedUrlLifetime(requestedSeconds, this.config.storage.signedUrlTtlSeconds);
  }

  async get(namespace: CacheNamespace, key: string): Promise<CachedResponse | undefined> {
    try {
      const generation = await this.generation(namespace);
      const raw = await this.redis.get(this.key(namespace, generation, key));
      if (raw === null) return undefined;
      return JSON.parse(raw) as CachedResponse;
    } catch (error) {
      this.degraded('read', error);
      return undefined;
    }
  }

  async set(
    namespace: CacheNamespace,
    key: string,
    value: CachedResponse,
    ttlSeconds: number,
  ): Promise<void> {
    try {
      const generation = await this.generation(namespace);
      await this.redis.setEx(
        this.key(namespace, generation, key),
        JSON.stringify(value),
        ttlSeconds,
      );
    } catch (error) {
      this.degraded('write', error);
    }
  }

  /**
   * Retires everything in a namespace.
   *
   * Called by the services after a successful write, inside the same request,
   * so the next read is already a miss — the DoD's "invalidates within one
   * request cycle".
   */
  async invalidate(...namespaces: CacheNamespace[]): Promise<void> {
    for (const namespace of namespaces) {
      try {
        await this.redis.incr(this.generationKey(namespace));
      } catch (error) {
        // A failed invalidation is the one cache error with a visible
        // consequence — stale content — so it is logged louder than a missed
        // read. It still must not fail the write that already succeeded.
        this.logger.warn(
          `Cache invalidation failed for "${namespace}"; content may be stale for up to its TTL: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }
  }

  /** Used when a change can touch anything — replacing or deleting a media asset. */
  async invalidateAll(): Promise<void> {
    await this.invalidate(...ALL_CACHE_NAMESPACES);
  }

  private async generation(namespace: CacheNamespace): Promise<number> {
    const raw = await this.redis.get(this.generationKey(namespace));
    const parsed = raw === null ? Number.NaN : Number.parseInt(raw, 10);
    // A missing counter is generation **0**, not 1, and the difference is a
    // real bug rather than a style choice: Redis `INCR` on a missing key also
    // yields 1, so reading the absent counter as 1 made the first purge of
    // every namespace a no-op. The symptom was stale content after the first
    // admin edit following a cache restart — and only then, which is the worst
    // kind of thing to debug from a report.
    //
    // A corrupt value falls back to 0 too: the worst case is one cold
    // namespace, which is a miss, which is correct.
    return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
  }

  private generationKey(namespace: CacheNamespace): string {
    return `cache:gen:${namespace}`;
  }

  private key(namespace: CacheNamespace, generation: number, key: string): string {
    return `cache:${namespace}:g${generation}:${key}`;
  }

  private degraded(operation: string, error: unknown): void {
    // Debug, not warn: if Redis is down this fires on every request, and a log
    // line per request is how an outage becomes two outages. Readiness already
    // reports the dependency as down.
    this.logger.debug(
      `Cache ${operation} failed, serving from source: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}
