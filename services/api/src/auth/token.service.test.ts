import { JwtService } from '@nestjs/jwt';
import { describe, expect, it } from 'vitest';
import { Role } from '@barff/types';
import { TokenService } from './token.service.js';
import { type AppConfigService } from '../common/config/app-config.service.js';

const ACCESS_SECRET = 'access-secret-that-is-long-enough-32';
const REFRESH_SECRET = 'refresh-secret-that-is-long-enough-32';

function makeService(overrides: Partial<{ accessTtl: number; refreshTtl: number }> = {}) {
  const config = {
    jwt: {
      accessSecret: ACCESS_SECRET,
      refreshSecret: REFRESH_SECRET,
      accessTtlSeconds: overrides.accessTtl ?? 900,
      refreshTtlSeconds: overrides.refreshTtl ?? 2_592_000,
    },
  } as AppConfigService;
  return new TokenService(new JwtService({}), config);
}

const subject = {
  userId: 'user-1',
  email: 'admin@barff.uz',
  roles: [Role.ADMIN],
  permissions: ['orders:read'],
};

describe('issueTokenPair', () => {
  it('issues a verifiable access token carrying roles and permissions', async () => {
    const service = makeService();
    const pair = await service.issueTokenPair(subject);
    const payload = await service.verifyAccessToken(pair.accessToken);

    expect(payload?.sub).toBe('user-1');
    expect(payload?.roles).toEqual([Role.ADMIN]);
    expect(payload?.permissions).toEqual(['orders:read']);
    expect(payload?.typ).toBe('access');
  });

  it('keeps the refresh token free of roles and permissions', async () => {
    // A refresh token is a bearer credential for getting new access; it should
    // not itself carry authority.
    const service = makeService();
    const pair = await service.issueTokenPair(subject);
    const payload = await service.verifyRefreshToken(pair.refreshToken);

    expect(payload).not.toBeNull();
    expect((payload as unknown as Record<string, unknown>)['permissions']).toBeUndefined();
    expect((payload as unknown as Record<string, unknown>)['roles']).toBeUndefined();
  });

  it('gives each pair a fresh jti but keeps the session id when rotating', async () => {
    const service = makeService();
    const first = await service.issueTokenPair(subject);
    const rotated = await service.issueTokenPair({ ...subject, sessionId: first.sessionId });

    expect(rotated.sessionId).toBe(first.sessionId);
    expect(rotated.refreshTokenId).not.toBe(first.refreshTokenId);
  });

  it('starts a new session id when none is supplied', async () => {
    const service = makeService();
    const first = await service.issueTokenPair(subject);
    const second = await service.issueTokenPair(subject);
    expect(second.sessionId).not.toBe(first.sessionId);
  });
});

describe('verification', () => {
  it('rejects a refresh token presented as an access token', async () => {
    // The separate secrets are the primary defence; the `typ` check is the
    // second one. Either alone would do — this asserts the pair holds.
    const service = makeService();
    const pair = await service.issueTokenPair(subject);
    expect(await service.verifyAccessToken(pair.refreshToken)).toBeNull();
    expect(await service.verifyRefreshToken(pair.accessToken)).toBeNull();
  });

  it('rejects a token signed with the wrong secret', async () => {
    const service = makeService();
    const foreign = new JwtService({}).sign(
      { sub: 'user-1', typ: 'access' },
      { secret: 'a-completely-different-secret-32chars', expiresIn: 900 },
    );
    expect(await service.verifyAccessToken(foreign)).toBeNull();
  });

  it('rejects an expired token', async () => {
    const service = makeService({ accessTtl: 1 });
    const pair = await service.issueTokenPair(subject);
    // jsonwebtoken compares against whole seconds; wait past the boundary.
    await new Promise((resolve) => setTimeout(resolve, 1500));
    expect(await service.verifyAccessToken(pair.accessToken)).toBeNull();
  });

  it('rejects a tampered token', async () => {
    const service = makeService();
    const pair = await service.issueTokenPair(subject);
    const [header, payload, signature] = pair.accessToken.split('.');
    const forged = Buffer.from(
      JSON.stringify({ sub: 'user-1', typ: 'access', permissions: ['settings:update'] }),
    ).toString('base64url');
    expect(await service.verifyAccessToken(`${header}.${forged}.${signature}`)).toBeNull();
    expect(payload).toBeDefined();
  });

  it('rejects malformed input rather than throwing', async () => {
    const service = makeService();
    for (const bad of ['', 'not-a-jwt', 'a.b.c']) {
      await expect(service.verifyAccessToken(bad)).resolves.toBeNull();
    }
  });
});
