import { describe, expect, it } from 'vitest';
import { validateEnv } from './env.schema.js';

const minimalEnv = {
  DATABASE_URL: 'postgresql://barff:pw@localhost:5432/barff',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_SECRET: 'an-access-secret-of-at-least-32-characters',
  JWT_REFRESH_SECRET: 'a-refresh-secret-of-at-least-32-characters',
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
    const { DATABASE_URL: _db, ...withoutDatabase } = minimalEnv;
    const { REDIS_URL: _redis, ...withoutRedis } = minimalEnv;
    expect(() => validateEnv(withoutDatabase)).toThrow(/DATABASE_URL/);
    expect(() => validateEnv(withoutRedis)).toThrow(/REDIS_URL/);
  });

  it('requires both JWT secrets — there is no development fallback', () => {
    // A default secret is how a placeholder reaches production and every token
    // becomes forgeable. Refusing to start is the cheaper failure.
    const { JWT_ACCESS_SECRET: _a, ...withoutAccess } = minimalEnv;
    const { JWT_REFRESH_SECRET: _r, ...withoutRefresh } = minimalEnv;
    expect(() => validateEnv(withoutAccess)).toThrow(/JWT_ACCESS_SECRET/);
    expect(() => validateEnv(withoutRefresh)).toThrow(/JWT_REFRESH_SECRET/);
  });

  it('rejects a JWT secret that is too short for HS256', () => {
    expect(() => validateEnv({ ...minimalEnv, JWT_ACCESS_SECRET: 'short' })).toThrow(/at least 32/);
  });

  it('rejects reusing one secret for both token types', () => {
    // Sharing a key makes a refresh token a valid access token, and the short
    // access lifetime buys nothing.
    expect(() =>
      validateEnv({ ...minimalEnv, JWT_REFRESH_SECRET: minimalEnv.JWT_ACCESS_SECRET }),
    ).toThrow(/must differ/);
  });

  it('refuses insecure cookies in production', () => {
    expect(() =>
      validateEnv({ ...minimalEnv, NODE_ENV: 'production', COOKIE_SECURE: 'false' }),
    ).toThrow(/COOKIE_SECURE/);
  });

  it('applies the auth defaults', () => {
    const env = validateEnv({ ...minimalEnv });
    expect(env.JWT_ACCESS_TTL).toBe(900);
    expect(env.LOGIN_MAX_ATTEMPTS).toBe(5);
    expect(env.COOKIE_SECURE).toBe(true);
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
