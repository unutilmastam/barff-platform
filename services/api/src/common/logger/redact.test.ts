import { describe, expect, it } from 'vitest';
import { isSensitiveKey, redact, REDACTED } from './redact.js';

describe('isSensitiveKey', () => {
  it('matches the obvious secret names', () => {
    for (const key of ['password', 'accessToken', 'Authorization', 'API_KEY', 'refresh_token']) {
      expect(isSensitiveKey(key)).toBe(true);
    }
  });

  it('matches compound names without enumerating them', () => {
    expect(isSensitiveKey('newPassword')).toBe(true);
    expect(isSensitiveKey('password_confirmation')).toBe(true);
    expect(isSensitiveKey('jwtRefreshTokenSecret')).toBe(true);
  });

  it('leaves ordinary fields alone', () => {
    for (const key of ['email', 'dealerId', 'orderStatus', 'quantity']) {
      expect(isSensitiveKey(key)).toBe(false);
    }
  });
});

describe('redact', () => {
  it('replaces secrets and keeps the rest', () => {
    const result = redact({ email: 'dealer@barff.uz', password: 'hunter2' }) as Record<
      string,
      unknown
    >;
    expect(result['email']).toBe('dealer@barff.uz');
    expect(result['password']).toBe(REDACTED);
  });

  it('reaches nested objects and arrays', () => {
    const result = redact({
      user: { email: 'a@barff.uz', accessToken: 'jwt' },
      sessions: [{ refreshToken: 'r1' }, { refreshToken: 'r2' }],
    }) as {
      user: { email: string; accessToken: string };
      sessions: { refreshToken: string }[];
    };

    expect(result.user.email).toBe('a@barff.uz');
    expect(result.user.accessToken).toBe(REDACTED);
    expect(result.sessions[0]?.refreshToken).toBe(REDACTED);
    expect(result.sessions[1]?.refreshToken).toBe(REDACTED);
  });

  it('survives a cycle rather than throwing', () => {
    const cyclic: Record<string, unknown> = { name: 'order' };
    cyclic['self'] = cyclic;
    const result = redact(cyclic) as Record<string, unknown>;
    expect(result['name']).toBe('order');
    expect(result['self']).toBe('[Circular]');
  });

  it('caps depth', () => {
    let deep: Record<string, unknown> = { value: 'bottom' };
    for (let i = 0; i < 20; i += 1) deep = { nested: deep };
    expect(JSON.stringify(redact(deep))).toContain('[MaxDepth]');
  });

  it('serializes errors and dates without losing them', () => {
    const result = redact({
      when: new Date('2026-08-27T10:00:00Z'),
      why: new Error('boom'),
    }) as { when: string; why: { message: string } };
    expect(result.when).toBe('2026-08-27T10:00:00.000Z');
    expect(result.why.message).toBe('boom');
  });

  it('passes primitives straight through', () => {
    expect(redact('plain')).toBe('plain');
    expect(redact(42)).toBe(42);
    expect(redact(null)).toBeNull();
  });
});
