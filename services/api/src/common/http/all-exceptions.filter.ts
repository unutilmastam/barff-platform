import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { type Request, type Response } from 'express';
import { type ApiError } from '@barff/types';
import { errorCodeForStatus, VALIDATION_FAILED } from './error-codes.js';
import { getRequestId } from './request-context.js';

/**
 * Turns every thrown value into the one documented error shape.
 *
 * Two rules matter here:
 *
 * 1. **Nothing leaks.** A 5xx returns a generic message; the real error and its
 *    stack go to the log, tied to the same `requestId` the caller received. An
 *    unhandled `QueryFailedError` must never hand a client our SQL.
 * 2. **Every failure is traceable.** The response always carries `requestId`,
 *    so a dealer reporting "it failed at 14:32" gives support an exact lookup
 *    key.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request>();

    const status = resolveStatus(exception);
    const requestId = getRequestId() ?? 'unknown';

    // Terminus reports *which* dependency failed in its own payload. Flattening
    // that into the generic error shape would leave an operator with a 503 and
    // no idea whether Postgres or Redis is down — which is the only thing the
    // probe exists to tell them. Health responses pass through untouched; the
    // request id is already on the response header.
    const healthPayload = resolveHealthCheckPayload(exception);
    if (healthPayload !== undefined) {
      if (!response.headersSent) response.status(status).json(healthPayload);
      this.logger.warn(`Health check reported ${status}`, {
        method: request.method,
        path: request.originalUrl,
      });
      return;
    }

    const body: ApiError = {
      statusCode: status,
      message: resolveMessage(exception, status),
      code: resolveCode(exception, status),
      requestId,
    };

    const details = resolveDetails(exception);
    if (details !== undefined) body.details = details;

    // 5xx is our bug; 4xx is the caller's. Logging every 404 at error level
    // would bury the failures that actually need attention.
    const logPayload = {
      statusCode: status,
      method: request.method,
      path: request.originalUrl,
    };
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `Unhandled exception on ${request.method} ${request.originalUrl}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    } else {
      this.logger.warn(`${body.code} on ${request.method} ${request.originalUrl}`, logPayload);
    }

    if (response.headersSent) {
      // A streamed response already committed its status; anything written now
      // would corrupt the payload.
      response.end();
      return;
    }

    response.status(status).json(body);
  }
}

/**
 * Recognises a `@nestjs/terminus` health-check body.
 *
 * Terminus throws a `ServiceUnavailableException` whose response carries
 * `{ status, info, error, details }`. Matching on that shape avoids importing
 * terminus into the generic filter.
 */
function resolveHealthCheckPayload(exception: unknown): Record<string, unknown> | undefined {
  if (!(exception instanceof HttpException)) return undefined;

  const payload = exception.getResponse();
  if (!isRecord(payload)) return undefined;

  const looksLikeHealthCheck =
    typeof payload['status'] === 'string' &&
    isRecord(payload['details']) &&
    (isRecord(payload['info']) || isRecord(payload['error']));

  return looksLikeHealthCheck ? payload : undefined;
}

function resolveStatus(exception: unknown): number {
  return exception instanceof HttpException
    ? exception.getStatus()
    : HttpStatus.INTERNAL_SERVER_ERROR;
}

function resolveMessage(exception: unknown, status: number): string {
  if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
    // Never surface an internal message or stack to the caller.
    return 'Internal server error';
  }
  if (exception instanceof HttpException) {
    const payload = exception.getResponse();
    if (typeof payload === 'string') return payload;
    if (isRecord(payload)) {
      const message = payload['message'];
      if (typeof message === 'string') return message;
      // Nest's ValidationPipe yields an array of strings.
      if (Array.isArray(message) && message.length > 0) return 'Validation failed';
    }
    return exception.message;
  }
  return 'Unexpected error';
}

function resolveCode(exception: unknown, status: number): string {
  if (exception instanceof HttpException) {
    const payload = exception.getResponse();
    if (isRecord(payload)) {
      const code = payload['code'];
      // A domain exception can pin its own code, e.g. ORDER_ALREADY_CONFIRMED.
      if (typeof code === 'string' && code.length > 0) return code;
      if (Array.isArray(payload['message'])) return VALIDATION_FAILED;
    }
  }
  return errorCodeForStatus(status);
}

function resolveDetails(exception: unknown): Record<string, string[]> | undefined {
  if (!(exception instanceof HttpException)) return undefined;

  const payload = exception.getResponse();
  if (!isRecord(payload)) return undefined;

  const existing = payload['details'];
  if (isRecord(existing)) return existing as Record<string, string[]>;

  const message = payload['message'];
  if (!Array.isArray(message)) return undefined;

  // class-validator returns a flat string list; group it by the field the
  // message starts with so clients can attach errors to inputs.
  const grouped: Record<string, string[]> = {};
  for (const entry of message) {
    if (typeof entry !== 'string') continue;
    const field = entry.split(' ')[0] ?? '_';
    (grouped[field] ??= []).push(entry);
  }
  return Object.keys(grouped).length > 0 ? grouped : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
