/**
 * HTTP status → stable error code.
 *
 * Clients branch on `code`, never on `message`: messages are human text that
 * gets translated and reworded, codes are contract. Domain modules add their
 * own specific codes (e.g. `ORDER_TRANSITION_NOT_ALLOWED`) by throwing an
 * `HttpException` whose body carries one.
 */
export const HTTP_STATUS_ERROR_CODE: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  405: 'METHOD_NOT_ALLOWED',
  409: 'CONFLICT',
  410: 'GONE',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  422: 'UNPROCESSABLE_ENTITY',
  429: 'TOO_MANY_REQUESTS',
  500: 'INTERNAL_SERVER_ERROR',
  502: 'BAD_GATEWAY',
  503: 'SERVICE_UNAVAILABLE',
  504: 'GATEWAY_TIMEOUT',
};

export const VALIDATION_FAILED = 'VALIDATION_FAILED';

export function errorCodeForStatus(status: number): string {
  return HTTP_STATUS_ERROR_CODE[status] ?? (status >= 500 ? 'INTERNAL_SERVER_ERROR' : 'ERROR');
}
