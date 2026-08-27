import { type ApiError, isApiError } from '@barff/types';

/**
 * Client for `api.barff.uz`.
 *
 * Every failure surfaces as an `ApiRequestError` carrying the server's
 * `ApiError` — the same shape `services/api` guarantees — so UI code branches
 * on a stable `code` rather than parsing a translated `message`.
 */

const DEFAULT_BASE_URL = 'http://localhost:4000/api/v1';

function baseUrl(): string {
  // NEXT_PUBLIC_* is inlined at build time and ends up in the client bundle,
  // so it may only ever hold public values. Never a secret (§12).
  return process.env['NEXT_PUBLIC_API_URL'] ?? DEFAULT_BASE_URL;
}

export class ApiRequestError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly requestId: string | undefined;
  readonly details: Record<string, string[]> | undefined;

  constructor(error: ApiError) {
    super(error.message);
    this.name = 'ApiRequestError';
    this.statusCode = error.statusCode;
    this.code = error.code;
    this.requestId = error.requestId;
    this.details = error.details;
  }

  /** Retrying a 4xx sends the same rejected request again. */
  get isRetryable(): boolean {
    return this.statusCode >= 500 || this.statusCode === 429;
  }
}

/** Network failure, DNS, timeout — the request never reached the API. */
export class ApiUnreachableError extends Error {
  constructor(cause: unknown) {
    super('The API could not be reached');
    this.name = 'ApiUnreachableError';
    this.cause = cause;
  }
}

export interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Locale for `Accept-Language`, so the API can localize its messages. */
  locale?: string;
  searchParams?: Record<string, string | number | boolean | undefined>;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 15_000;

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { body, locale, searchParams, timeoutMs = DEFAULT_TIMEOUT_MS, ...init } = options;

  const url = new URL(`${baseUrl()}${path.startsWith('/') ? path : `/${path}`}`);
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  if (locale !== undefined) headers.set('Accept-Language', locale);

  // Without a timeout a hung request keeps a loading spinner on screen forever;
  // the user has no way to tell that from "still working".
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers,
      // Auth rides in HttpOnly cookies (S04), which are only sent when the
      // request explicitly includes credentials.
      credentials: 'include',
      signal: init.signal ?? controller.signal,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch (cause) {
    throw new ApiUnreachableError(cause);
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const payload: unknown = await response.json().catch(() => undefined);

  if (!response.ok) {
    if (isApiError(payload)) {
      throw new ApiRequestError(payload);
    }
    // A proxy or load balancer can return an error page the API never saw, so
    // the documented shape is not guaranteed on every failure.
    throw new ApiRequestError({
      statusCode: response.status,
      message: response.statusText || 'Request failed',
      code: 'UNEXPECTED_RESPONSE',
      requestId: response.headers.get('x-request-id') ?? '',
    });
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string, options?: ApiRequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: ApiRequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, options?: ApiRequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, options?: ApiRequestOptions) =>
    apiRequest<T>(path, { ...options, method: 'DELETE' }),
};
