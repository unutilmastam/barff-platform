import { Injectable, type NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { type NextFunction, type Request, type Response } from 'express';
import { runWithRequestContext } from './request-context.js';

export const REQUEST_ID_HEADER = 'x-request-id';

/** A client-supplied id must look like one before it is trusted into our logs. */
const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;

/**
 * Assigns every request an id and echoes it back on the response.
 *
 * An inbound `x-request-id` is reused so a trace survives across Cloudflare,
 * the load balancer and the frontend — but only after a format check, because
 * the value is attacker-controlled and ends up in log records. Anything
 * unexpected is replaced rather than rejected: a malformed header is not worth
 * failing a request over.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    const incoming = request.headers[REQUEST_ID_HEADER];
    const candidate = Array.isArray(incoming) ? incoming[0] : incoming;
    const requestId =
      typeof candidate === 'string' && REQUEST_ID_PATTERN.test(candidate)
        ? candidate
        : randomUUID();

    response.setHeader(REQUEST_ID_HEADER, requestId);
    runWithRequestContext({ requestId }, () => {
      next();
    });
  }
}
