/**
 * API transport contracts shared by every client.
 *
 * The error shape is fixed by `ROADMAP.md` S02: the exception filter returns
 * `{ statusCode, message, code, requestId }` for every failure, so clients can
 * rely on it without special-casing endpoints.
 */
export interface ApiError {
  statusCode: number;
  message: string;
  /** Stable machine-readable code, e.g. `ORDER_TRANSITION_NOT_ALLOWED`. */
  code: string;
  /** Correlates the response with server logs. */
  requestId: string;
  /** Field-level validation failures, keyed by the input path. */
  details?: Record<string, string[]>;
}

export function isApiError(value: unknown): value is ApiError {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate['statusCode'] === 'number' &&
    typeof candidate['message'] === 'string' &&
    typeof candidate['code'] === 'string' &&
    typeof candidate['requestId'] === 'string'
  );
}

/** Identifier type used across the domain. Postgres UUIDs via Prisma. */
export type Id = string;

/** ISO-8601 timestamp string as serialized by the API. */
export type IsoDateTime = string;

export interface Timestamps {
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}
