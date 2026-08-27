import { Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { runWithRequestContext } from '../http/request-context.js';
import { StructuredLogger, toStructuredLevel } from './structured-logger.service.js';

function captureLogger(level: 'debug' | 'info' | 'warn' | 'error' = 'debug') {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(String(chunk));
      callback();
    },
  });
  return { logger: new StructuredLogger(level, undefined, stream), lines };
}

function parse(lines: string[]) {
  return lines.map((line) => JSON.parse(line) as Record<string, unknown>);
}

describe('StructuredLogger', () => {
  it('writes one JSON object per line', () => {
    const { logger, lines } = captureLogger();
    logger.log('API started');

    expect(lines).toHaveLength(1);
    expect(lines[0]?.endsWith('\n')).toBe(true);
    const [record] = parse(lines);
    expect(record?.['message']).toBe('API started');
    expect(record?.['level']).toBe('info');
    expect(typeof record?.['timestamp']).toBe('string');
  });

  it('honours the minimum level', () => {
    const { logger, lines } = captureLogger('warn');
    logger.debug('noise');
    logger.log('also noise');
    logger.warn('kept');
    logger.error('kept too');
    expect(parse(lines).map((r) => r['level'])).toEqual(['warn', 'error']);
  });

  it('attaches the ambient request id', () => {
    const { logger, lines } = captureLogger();
    runWithRequestContext({ requestId: 'req-12345678' }, () => {
      logger.log('inside a request');
    });
    logger.log('outside a request');

    const [inside, outside] = parse(lines);
    expect(inside?.['requestId']).toBe('req-12345678');
    expect(outside?.['requestId']).toBeUndefined();
  });

  it('redacts secrets in structured details', () => {
    const { logger, lines } = captureLogger();
    logger.log('login attempt', { email: 'dealer@barff.uz', password: 'hunter2' }, 'AuthService');

    const [record] = parse(lines);
    expect(record?.['context']).toBe('AuthService');
    const serialized = lines[0] ?? '';
    expect(serialized).toContain('dealer@barff.uz');
    expect(serialized).not.toContain('hunter2');
    expect(serialized).toContain('[REDACTED]');
  });

  it('treats a trailing string as the Nest context', () => {
    const { logger, lines } = captureLogger();
    logger.log('created', 'OrdersService');
    const [record] = parse(lines);
    expect(record?.['context']).toBe('OrdersService');
    expect(record?.['details']).toBeUndefined();
  });

  it('keeps a multi-line stack as detail rather than context', () => {
    const { logger, lines } = captureLogger();
    logger.error('failed', 'Error: boom\n    at somewhere');
    const [record] = parse(lines);
    expect(record?.['context']).toBeUndefined();
    expect(record?.['details']).toBeDefined();
  });

  it('scopes a child logger to a context', () => {
    const { logger, lines } = captureLogger();
    logger.child('HealthController').log('probed');
    expect(parse(lines)[0]?.['context']).toBe('HealthController');
  });

  it('never throws on an unserializable payload', () => {
    const { logger, lines } = captureLogger();
    const bad = {
      toJSON() {
        throw new Error('nope');
      },
    };
    expect(() => logger.log('weird', bad)).not.toThrow();
    expect(lines).toHaveLength(1);
  });

  it('maps Nest levels onto the configured ones', () => {
    expect(toStructuredLevel('log')).toBe('info');
    expect(toStructuredLevel('verbose')).toBe('debug');
    expect(toStructuredLevel('fatal')).toBe('error');
    expect(toStructuredLevel('unknown')).toBe('info');
  });
});
