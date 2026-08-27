/**
 * Redaction for structured log records.
 *
 * `CLAUDE.md` §12 forbids logging passwords and tokens, and §23 forbids them in
 * audit rows. Relying on every call site to remember that will fail eventually,
 * so redaction happens centrally, on the way out.
 *
 * The match is on the *key*, case-insensitively and as a substring, so
 * `password`, `newPassword` and `password_confirmation` are all caught without
 * enumerating them.
 */
const SENSITIVE_KEY_PATTERNS = [
  'password',
  'passwd',
  'secret',
  'token',
  'authorization',
  'cookie',
  'apikey',
  'api_key',
  'accesskey',
  'access_key',
  'privatekey',
  'private_key',
  'credential',
  'signature',
  'otp',
  'pin',
] as const;

export const REDACTED = '[REDACTED]';

export function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase();
  return SENSITIVE_KEY_PATTERNS.some((pattern) => normalized.includes(pattern));
}

/**
 * Deep-copies a value with sensitive fields replaced.
 *
 * Cycles are tolerated (they become `'[Circular]'`) because a logger must never
 * be the thing that crashes a request. Depth is capped for the same reason.
 */
export function redact(value: unknown, maxDepth = 8): unknown {
  return redactInternal(value, maxDepth, new WeakSet());
}

function redactInternal(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (depth <= 0) {
    return '[MaxDepth]';
  }
  if (seen.has(value)) {
    return '[Circular]';
  }
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((entry) => redactInternal(entry, depth - 1, seen));
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }

  const output: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    output[key] = isSensitiveKey(key) ? REDACTED : redactInternal(entry, depth - 1, seen);
  }
  return output;
}
