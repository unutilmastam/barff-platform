import { type LoggerService, type LogLevel } from '@nestjs/common';
import { getRequestId } from '../http/request-context.js';
import { redact } from './redact.js';

export type StructuredLogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_SEVERITY: Record<StructuredLogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

/** Nest's own level names do not match the ones operators configure. */
const NEST_LEVEL_MAP: Record<string, StructuredLogLevel> = {
  verbose: 'debug',
  debug: 'debug',
  log: 'info',
  warn: 'warn',
  error: 'error',
  fatal: 'error',
};

export interface LogRecord {
  timestamp: string;
  level: StructuredLogLevel;
  message: string;
  context?: string;
  requestId?: string;
  [key: string]: unknown;
}

/**
 * One JSON object per line, on stdout.
 *
 * CloudWatch (and any other collector) parses that directly, which Nest's
 * default pretty-printed output does not allow. Every record carries the
 * current request id, picked up from `AsyncLocalStorage` rather than threaded
 * through call signatures, so a log line can always be tied back to the
 * response the client saw.
 *
 * Deliberately not pino: the requirement here is redaction (§12), and owning
 * the serializer is the shortest path to guaranteeing it. Swapping in pino at
 * S41 stays possible — nothing outside this file knows the format.
 */
export class StructuredLogger implements LoggerService {
  constructor(
    private readonly minLevel: StructuredLogLevel = 'info',
    private readonly context?: string,
    private readonly stream: NodeJS.WritableStream = process.stdout,
  ) {}

  /** Scoped child logger, so a module tags every line without repeating itself. */
  child(context: string): StructuredLogger {
    return new StructuredLogger(this.minLevel, context, this.stream);
  }

  log(message: unknown, ...optional: unknown[]): void {
    this.write('info', message, optional);
  }

  error(message: unknown, ...optional: unknown[]): void {
    this.write('error', message, optional);
  }

  warn(message: unknown, ...optional: unknown[]): void {
    this.write('warn', message, optional);
  }

  debug(message: unknown, ...optional: unknown[]): void {
    this.write('debug', message, optional);
  }

  verbose(message: unknown, ...optional: unknown[]): void {
    this.write('debug', message, optional);
  }

  fatal(message: unknown, ...optional: unknown[]): void {
    this.write('error', message, optional);
  }

  setLogLevels?(_levels: LogLevel[]): void {
    // Level is configured through LOG_LEVEL; Nest's runtime setter is ignored
    // so there is exactly one source of truth.
  }

  private write(level: StructuredLogLevel, message: unknown, optional: unknown[]): void {
    if (LEVEL_SEVERITY[level] < LEVEL_SEVERITY[this.minLevel]) return;

    const record: LogRecord = {
      timestamp: new Date().toISOString(),
      level,
      message: typeof message === 'string' ? message : safeStringify(redact(message)),
    };

    const requestId = getRequestId();
    if (requestId !== undefined) record.requestId = requestId;

    // Nest passes a trailing context string on most calls, and an error stack
    // before it on `error`.
    const extras = [...optional];
    const last = extras[extras.length - 1];
    let context: string | undefined;
    if (typeof last === 'string' && !last.includes('\n')) {
      context = last;
      extras.pop();
    }
    const resolvedContext = context ?? this.context;
    if (resolvedContext !== undefined) record.context = resolvedContext;

    if (extras.length > 0) {
      record.details = extras.map((entry) => redact(entry));
    }

    this.stream.write(`${safeStringify(record)}\n`);
  }
}

/** Never let an unserializable payload take down the request that logged it. */
function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

export function toStructuredLevel(level: string): StructuredLogLevel {
  return NEST_LEVEL_MAP[level] ?? 'info';
}
