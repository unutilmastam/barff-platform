import { Injectable, type NestMiddleware } from '@nestjs/common';
import { type NextFunction, type Request, type Response } from 'express';

/**
 * Stamps `Cache-Control: no-store` on every response, before anything runs.
 *
 * Middleware, not the interceptor, because of where Nest puts each of them:
 * guards run *before* interceptors, so a request rejected by `JwtAuthGuard` or
 * `PermissionsGuard` never reaches an interceptor at all. If the default lived
 * there, every 401 and 403 — and every response produced by the exception
 * filter — would go out with no cache directive whatsoever, and a shared cache
 * is entitled to make its own guess about those.
 *
 * `HttpCacheInterceptor` overwrites this header for the routes that opt in with
 * `@PublicCache()`. Private by default, cacheable by decision (§12).
 */
@Injectable()
export class NoStoreMiddleware implements NestMiddleware {
  use(_request: Request, response: Response, next: NextFunction): void {
    response.setHeader('Cache-Control', 'no-store');
    next();
  }
}
