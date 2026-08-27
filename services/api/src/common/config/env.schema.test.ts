import { describe, expect, it } from 'vitest';
import { validateEnv } from './env.schema.js';

const minimalEnv = {
  DATABASE_URL: 'postgresql://barff:pw@localhost:5432/barff',
  REDIS_URL: 'redis://localhost:6379',
};

describe('validateEnv', () => {
  it('applies defaults for everything optional', () => {
    const env = validateEnv({ ...minimalEnv });
    expect(env.NODE_ENV).toBe('development');
    expect(env.API_PORT).toBe(4000);
    expect(env.API_GLOBAL_PREFIX).toBe('api');
    expect(env.RATE_LIMIT_LIMIT).toBe(120);
    expect(env.CORS_ALLOWED_ORIGINS).toEqual([]);
  });

  it('fails fast when a required variable is missing', () => {
    expect(() => validateEnv({ REDIS_URL: 'redis://localhost:6379' })).toThrow(/DATABASE_URL/);
    expect(() => validateEnv({ DATABASE_URL: minimalEnv.DATABASE_URL })).toThrow(/REDIS_URL/);
  });

  it('reports every problem at once, not one per restart', () => {
    let message = '';
    try {
      validateEnv({});
    } catch (error) {
      message = error instanceof Error ? error.message : '';
    }
    expect(message).toContain('DATABASE_URL');
    expect(message).toContain('REDIS_URL');
  });

  it('coerces numeric strings from the environment', () => {
    const env = validateEnv({ ...minimalEnv, API_PORT: '8080', RATE_LIMIT_TTL: '30' });
    expect(env.API_PORT).toBe(8080);
    expect(env.RATE_LIMIT_TTL).toBe(30);
  });

  it('rejects an out-of-range port', () => {
    expect(() => validateEnv({ ...minimalEnv, API_PORT: '70000' })).toThrow(/API_PORT/);
  });

  it('parses the CORS origin list', () => {
    const env = validateEnv({
      ...minimalEnv,
      CORS_ALLOWED_ORIGINS: 'https://barff.uz, https://admin.barff.uz',
    });
    expect(env.CORS_ALLOWED_ORIGINS).toEqual(['https://barff.uz', 'https://admin.barff.uz']);
  });

  it('refuses a trailing slash, which would never match an Origin header', () => {
    expect(() => validateEnv({ ...minimalEnv, CORS_ALLOWED_ORIGINS: 'https://barff.uz/' })).toThrow(
      /trailing slash/,
    );
  });

  it('refuses a non-URL origin instead of silently allowing nothing', () => {
    expect(() => validateEnv({ ...minimalEnv, CORS_ALLOWED_ORIGINS: 'barff.uz' })).toThrow();
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(() => validateEnv({ ...minimalEnv, NODE_ENV: 'prod' })).toThrow(/NODE_ENV/);
  });
});
