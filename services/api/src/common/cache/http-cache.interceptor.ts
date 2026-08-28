import { createHash } from 'node:crypto';
import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type Request, type Response } from 'express';
import { concatMap, type Observable, of, tap } from 'rxjs';
import { CacheService } from './cache.service.js';
import {
  type CacheNamespace,
  INVALIDATES_CACHE_KEY,
  PUBLIC_CACHE_KEY,
  type PublicCacheOptions,
} from './cache.constants.js';

/**
 * Read-through cache, `ETag`/`If-None-Match`, and `Cache-Control` for the
 * public API (`CLAUDE.md` §26, §13's Cloudflare layer).
 *
 * Three jobs, in one place because they have to agree with each other:
 *
 * 1. **Serve from Redis** when a cacheable public GET has been rendered before.
 * 2. **Answer 304** when the client already holds that exact body. The ETag is
 *    a hash of the response, so it only stays stable while the cached copy
 *    does — which is precisely why caching and revalidation belong together
 *    here. Without the cache, every request re-signs its media URLs and the
 *    ETag changes each time, so `If-None-Match` would never match and
 *    revalidation would be pure overhead.
 * 3. **Retire what a write changed**, before the write's own response is sent,
 *    so the very next read is already a miss.
 * 4. **Refuse to let anything else be stored.** Every response that is not an
 *    explicitly cacheable public GET keeps the `no-store` that
 *    `NoStoreMiddleware` already applied — dealer orders, invoices, the media
 *    library and every admin screen. §12's rule is that private data must not
 *    sit in a shared cache, and the only reliable way to guarantee that is to
 *    make non-caching the default and caching the exception.
 */
@Injectable()
export class HttpCacheInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly cache: CacheService,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    if (context.getType() !== 'http') return next.handle();

    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    const targets = [context.getHandler(), context.getClass()];

    if (request.method !== 'GET') {
      const invalidates = this.reflector.getAllAndOverride<CacheNamespace[] | undefined>(
        INVALIDATES_CACHE_KEY,
        targets,
      );
      if (invalidates === undefined || invalidates.length === 0) return next.handle();

      return next.handle().pipe(
        // `concatMap`, not `tap`: the purge has to finish before the response
        // is emitted. With `tap` the promise would be left floating and a
        // client acting on its own 200 could re-read the old copy — exactly the
        // race the DoD's "within one request cycle" rules out.
        concatMap(async (body: unknown) => {
          if (response.statusCode >= 200 && response.statusCode < 300) {
            await this.cache.invalidate(...invalidates);
          }
          return body;
        }),
      );
    }

    const options = this.reflector.getAllAndOverride<PublicCacheOptions | undefined>(
      PUBLIC_CACHE_KEY,
      targets,
    );

    // Not cacheable: leave the middleware's `no-store` exactly as it is.
    if (options === undefined) return next.handle();

    const { redisSeconds, browserSeconds } = this.cache.clampTtl(options.ttlSeconds);
    const key = cacheKey(request);

    const cached = await this.cache.get(options.namespace, key);
    if (cached !== undefined) {
      this.applyHeaders(response, cached.etag, redisSeconds, browserSeconds, 'HIT');
      if (isNotModified(request, cached.etag)) return of(this.notModified(response));
      return of(cached.body);
    }

    return next.handle().pipe(
      tap((body: unknown) => {
        // Only successful renders are stored. A handler that threw never
        // reaches here, so an error is never cached — which would otherwise
        // turn one failed query into minutes of failure for everybody.
        if (response.statusCode >= 200 && response.statusCode < 300) {
          const etag = etagFor(body);
          this.applyHeaders(response, etag, redisSeconds, browserSeconds, 'MISS');
          void this.cache.set(options.namespace, key, { body, etag }, redisSeconds);
        }
      }),
    );
  }

  private applyHeaders(
    response: Response,
    etag: string,
    redisSeconds: number,
    browserSeconds: number,
    state: 'HIT' | 'MISS',
  ): void {
    response.setHeader('ETag', etag);
    response.setHeader(
      'Cache-Control',
      // `s-maxage` is what Cloudflare obeys; `max-age` is the browser's, and it
      // is deliberately the shorter of the two so a published change reaches a
      // returning visitor after one CDN purge rather than after their own
      // browser cache expires.
      `public, max-age=${browserSeconds}, s-maxage=${redisSeconds}, stale-while-revalidate=${redisSeconds}`,
    );
    // Responses carry all three locales in one payload, so there is nothing to
    // vary on. Stated explicitly because a wrong `Vary` is the classic way a
    // CDN serves one visitor's language to another.
    response.setHeader('X-Cache', state);
  }

  private notModified(response: Response): undefined {
    response.status(304);
    // 304 must not carry a body, and these two describe one that is not there.
    response.removeHeader('Content-Type');
    response.removeHeader('Content-Length');
    return undefined;
  }
}

/**
 * The cache key.
 *
 * Path plus **sorted** query parameters: `?page=2&category=x` and
 * `?category=x&page=2` are the same request, and keying on the raw string would
 * cache the same response twice and invalidate neither reliably. No header
 * enters the key — these routes are unauthenticated, and a key that varied by
 * header would be a way to poison it.
 */
export function cacheKey(request: Pick<Request, 'path' | 'query'>): string {
  const entries = Object.entries(request.query)
    .flatMap(([name, value]) =>
      Array.isArray(value)
        ? value.map((item) => [name, String(item)] as const)
        : [[name, String(value)] as const],
    )
    .sort(([a, aValue], [b, bValue]) => a.localeCompare(b) || aValue.localeCompare(bValue));

  const query = entries.map(([name, value]) => `${name}=${value}`).join('&');
  return query === '' ? request.path : `${request.path}?${query}`;
}

export function etagFor(body: unknown): string {
  return `"${createHash('sha256')
    .update(JSON.stringify(body) ?? 'null')
    .digest('hex')}"`;
}

/**
 * RFC 9110 lets `If-None-Match` carry a list, and a proxy may weaken an ETag to
 * `W/"…"` on the way through. Comparing the raw header against our tag would
 * then miss, and every revalidation would download the body again.
 */
export function isNotModified(request: Pick<Request, 'headers'>, etag: string): boolean {
  const header = request.headers['if-none-match'];
  if (typeof header !== 'string') return false;
  if (header.trim() === '*') return true;

  return header
    .split(',')
    .map((candidate) => candidate.trim().replace(/^W\//, ''))
    .includes(etag);
}
