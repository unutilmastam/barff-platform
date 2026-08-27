import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  requestId: string;
}

/**
 * Per-request store.
 *
 * The exception filter and the logger both need the request id, and neither is
 * reachable from the controller signature. Threading it through every service
 * would put a transport concern into the domain layer, so it rides in
 * `AsyncLocalStorage` instead.
 */
const storage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(context: RequestContext, callback: () => T): T {
  return storage.run(context, callback);
}

/** `undefined` outside a request — background jobs and boot-time logs. */
export function getRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}
