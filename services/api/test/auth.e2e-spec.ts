import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerStorage, type ThrottlerStorageService } from '@nestjs/throttler';
import { PrismaClient } from '../generated/prisma/index.js';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Role } from '@barff/types';
import { AppModule } from '../src/app.module.js';
import { AppConfigService } from '../src/common/config/app-config.service.js';
import { configureApp } from '../src/bootstrap.js';
import { hashPassword } from '../src/common/crypto/password.js';

/**
 * Auth end-to-end, against the real Postgres and Redis.
 *
 * Uses its own users (prefixed `s04-`) and deletes them afterwards, so it can
 * run alongside the seeded data without disturbing it.
 */
const PASSWORD = 'e2e-test-passphrase-2026';
const ADMIN_EMAIL = 's04-admin@barff.test';
const DEALER_EMAIL = 's04-dealer@barff.test';

const prisma = new PrismaClient();

async function createUser(email: string, roleKey: Role): Promise<string> {
  const role = await prisma.role.findUniqueOrThrow({ where: { key: roleKey } });
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash: await hashPassword(PASSWORD),
      isActive: true,
      deletedAt: null,
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
    create: { email, passwordHash: await hashPassword(PASSWORD), isActive: true },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: role.id } },
    update: {},
    create: { userId: user.id, roleId: role.id },
  });
  return user.id;
}

describe('auth (e2e)', () => {
  let app: INestApplication;
  let adminId: string;
  let throttlerStorage: ThrottlerStorageService;

  beforeAll(async () => {
    adminId = await createUser(ADMIN_EMAIL, Role.ADMIN);
    await createUser(DEALER_EMAIL, Role.DEALER);

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app, app.get(AppConfigService));
    throttlerStorage = app.get<ThrottlerStorageService>(ThrottlerStorage);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await prisma.auditLog.deleteMany({ where: { actorEmail: { startsWith: 's04-' } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: 's04-' } } });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Reset the lockout counters so one test's failures cannot lock out the
    // account another test logs into.
    await prisma.user.updateMany({
      where: { email: { startsWith: 's04-' } },
      data: { failedLoginAttempts: 0, lockedUntil: null, isActive: true },
    });

    // Clear the per-IP throttle between tests. Every request here comes from
    // the same address, and login is capped at 10/minute on purpose — without
    // this the suite trips its own rate limit and later tests fail with 429s
    // that look like auth bugs. The limit itself is verified deliberately in
    // `login — rate limiting` below.
    throttlerStorage.storage.clear();
  });

  const login = (email = ADMIN_EMAIL, password = PASSWORD) =>
    request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('X-Token-Delivery', 'body')
      .send({ email, password });

  describe('login — success', () => {
    it('returns the user with resolved roles and permissions', async () => {
      const response = await login().expect(200);
      expect(response.body.user.email).toBe(ADMIN_EMAIL);
      expect(response.body.user.roles).toEqual([Role.ADMIN]);
      expect(response.body.user.permissions.length).toBeGreaterThan(40);
      expect(response.body.expiresIn).toBe(900);
    });

    it('sets HttpOnly cookies, scoping the refresh cookie to the refresh route', async () => {
      const response = await login().expect(200);
      const cookies = response.headers['set-cookie'] as unknown as string[];

      const access = cookies.find((c) => c.startsWith('barff_access_token='));
      const refresh = cookies.find((c) => c.startsWith('barff_refresh_token='));

      expect(access).toContain('HttpOnly');
      expect(access).toContain('SameSite=Lax');
      expect(access).toContain('Path=/');
      expect(refresh).toContain('HttpOnly');
      // The refresh token is the account-takeover credential; it should not
      // ride along on every request to every route.
      expect(refresh).toContain('Path=/api/v1/auth/refresh');
    });

    it('normalizes the email, so case cannot create a second identity', async () => {
      const response = await login(ADMIN_EMAIL.toUpperCase()).expect(200);
      expect(response.body.user.email).toBe(ADMIN_EMAIL);
    });

    it('writes an audit row', async () => {
      await login().expect(200);
      const entry = await prisma.auditLog.findFirst({
        where: { action: 'user.login_succeeded', actorEmail: ADMIN_EMAIL },
        orderBy: { createdAt: 'desc' },
      });
      expect(entry).not.toBeNull();
      expect(entry?.requestId).not.toBeNull();
    });

    it('does not put tokens in the body unless the client asks', async () => {
      // Browsers must never receive the token in a readable response body, or
      // it ends up in localStorage and the HttpOnly cookie was pointless.
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: ADMIN_EMAIL, password: PASSWORD })
        .expect(200);
      expect(response.body.accessToken).toBeUndefined();
      expect(response.body.refreshToken).toBeUndefined();
      expect(response.headers['set-cookie']).toBeDefined();
    });
  });

  describe('login — wrong password', () => {
    it('rejects with 401', async () => {
      const response = await login(ADMIN_EMAIL, 'wrong-password').expect(401);
      expect(response.body.code).toBe('INVALID_CREDENTIALS');
    });

    it('answers identically for an unknown account — no user enumeration', async () => {
      const unknown = await login('s04-nobody@barff.test', PASSWORD).expect(401);
      const wrong = await login(ADMIN_EMAIL, 'wrong-password').expect(401);
      expect(unknown.body.message).toBe(wrong.body.message);
      expect(unknown.body.code).toBe(wrong.body.code);
    });

    it('records the real reason in the audit log even though the client is not told', async () => {
      await login(ADMIN_EMAIL, 'wrong-password').expect(401);
      const entry = await prisma.auditLog.findFirst({
        where: { action: 'user.login_failed', actorEmail: ADMIN_EMAIL },
        orderBy: { createdAt: 'desc' },
      });
      expect((entry?.after as Record<string, unknown>)?.['reason']).toBe('wrong_password');
    });

    it('never writes the password or a hash into the audit row', async () => {
      await login(ADMIN_EMAIL, 'super-secret-wrong-value').expect(401);
      const entry = await prisma.auditLog.findFirst({
        where: { action: 'user.login_failed', actorEmail: ADMIN_EMAIL },
        orderBy: { createdAt: 'desc' },
      });
      const serialized = JSON.stringify(entry);
      expect(serialized).not.toContain('super-secret-wrong-value');
      expect(serialized).not.toContain('$argon2');
    });

    it('locks the account after the configured number of attempts', async () => {
      for (let i = 0; i < 5; i += 1) {
        await login(DEALER_EMAIL, 'wrong-password').expect(401);
      }
      const locked = await prisma.user.findUniqueOrThrow({ where: { email: DEALER_EMAIL } });
      expect(locked.failedLoginAttempts).toBe(5);
      expect(locked.lockedUntil).not.toBeNull();

      // Even the correct password is refused while the lockout holds.
      const response = await login(DEALER_EMAIL, PASSWORD).expect(401);
      expect(response.body.code).toBe('INVALID_CREDENTIALS');
    });

    it('clears the counter after a successful login', async () => {
      await login(ADMIN_EMAIL, 'wrong-password').expect(401);
      await login().expect(200);
      const user = await prisma.user.findUniqueOrThrow({ where: { email: ADMIN_EMAIL } });
      expect(user.failedLoginAttempts).toBe(0);
      expect(user.lastLoginAt).not.toBeNull();
    });
  });

  describe('login — rate limiting', () => {
    it('returns 429 once the per-IP login limit is exceeded', async () => {
      // Per-IP, on top of the per-account lockout. Neither alone is enough:
      // IP-only is beaten by a botnet, account-only by spraying one password
      // across thousands of accounts.
      let sawTooManyRequests = false;
      for (let i = 0; i < 12; i += 1) {
        const response = await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send({ email: 's04-throttle@barff.test', password: 'whatever' });
        if (response.status === 429) {
          expect(response.body.code).toBe('TOO_MANY_REQUESTS');
          sawTooManyRequests = true;
          break;
        }
      }
      expect(sawTooManyRequests).toBe(true);
    });
  });

  describe('deactivated account', () => {
    it('is refused, and indistinguishably so', async () => {
      await prisma.user.update({ where: { email: DEALER_EMAIL }, data: { isActive: false } });
      const response = await login(DEALER_EMAIL, PASSWORD).expect(401);
      expect(response.body.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('/auth/me', () => {
    it('requires a token', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
      expect(response.body.code).toBe('UNAUTHENTICATED');
    });

    it('accepts the cookie', async () => {
      const session = await login().expect(200);
      const cookies = session.headers['set-cookie'] as unknown as string[];
      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Cookie', cookies)
        .expect(200);
      expect(response.body.email).toBe(ADMIN_EMAIL);
      expect(response.body.roles).toEqual([Role.ADMIN]);
    });

    it('accepts a bearer token, for the driver PWA', async () => {
      const session = await login().expect(200);
      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${session.body.accessToken}`)
        .expect(200);
      expect(response.body.email).toBe(ADMIN_EMAIL);
    });

    it('never returns the password hash', async () => {
      const session = await login().expect(200);
      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${session.body.accessToken}`)
        .expect(200);
      expect(JSON.stringify(response.body)).not.toContain('argon2');
      expect(response.body.passwordHash).toBeUndefined();
    });

    it('rejects a garbage token', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer not-a-real-token')
        .expect(401);
      expect(response.body.code).toBe('INVALID_ACCESS_TOKEN');
    });

    it('reflects a deactivation the token does not know about', async () => {
      const session = await login(DEALER_EMAIL).expect(200);
      await prisma.user.update({ where: { email: DEALER_EMAIL }, data: { isActive: false } });
      // The access token is still cryptographically valid — /auth/me re-reads
      // the database precisely so a client can discover this.
      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${session.body.accessToken}`)
        .expect(403);
      expect(response.body.code).toBe('ACCOUNT_INACTIVE');
    });
  });

  describe('refresh rotation', () => {
    it('issues a new pair and invalidates the old refresh token', async () => {
      const session = await login().expect(200);
      const first = session.body.refreshToken as string;

      const rotated = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('X-Token-Delivery', 'body')
        .send({ refreshToken: first })
        .expect(200);

      expect(rotated.body.refreshToken).not.toBe(first);
      expect(rotated.body.user.email).toBe(ADMIN_EMAIL);

      // The new one works.
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('X-Token-Delivery', 'body')
        .send({ refreshToken: rotated.body.refreshToken })
        .expect(200);
    });

    it('revokes the whole session when a rotated token is presented again', async () => {
      const session = await login().expect(200);
      const first = session.body.refreshToken as string;

      const rotated = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('X-Token-Delivery', 'body')
        .send({ refreshToken: first })
        .expect(200);

      // Replaying the consumed token means it leaked; the server cannot tell
      // the thief from the user, so both lose the session.
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: first })
        .expect(401);

      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: rotated.body.refreshToken })
        .expect(401);

      const entry = await prisma.auditLog.findFirst({
        where: { action: 'user.token_reuse_detected', actorUserId: adminId },
        orderBy: { createdAt: 'desc' },
      });
      expect(entry).not.toBeNull();
    });

    it('rejects a refresh with no token at all', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({})
        .expect(401);
      expect(response.body.code).toBe('INVALID_SESSION');
    });

    it('rejects an access token presented as a refresh token', async () => {
      const session = await login().expect(200);
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: session.body.accessToken })
        .expect(401);
    });

    it('picks up a role change without waiting for the refresh token to expire', async () => {
      const session = await login(DEALER_EMAIL).expect(200);
      expect(session.body.user.roles).toEqual([Role.DEALER]);

      const sales = await prisma.role.findUniqueOrThrow({ where: { key: Role.SALES } });
      const dealer = await prisma.user.findUniqueOrThrow({ where: { email: DEALER_EMAIL } });
      await prisma.userRole.create({ data: { userId: dealer.id, roleId: sales.id } });

      const rotated = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .set('X-Token-Delivery', 'body')
        .send({ refreshToken: session.body.refreshToken })
        .expect(200);

      expect(rotated.body.user.roles).toContain(Role.SALES);
      await prisma.userRole.deleteMany({ where: { userId: dealer.id, roleId: sales.id } });
    });
  });

  describe('logout', () => {
    it('requires authentication', async () => {
      await request(app.getHttpServer()).post('/api/v1/auth/logout').expect(401);
    });

    it('revokes the session and clears the cookies', async () => {
      const session = await login().expect(200);
      const cookies = session.headers['set-cookie'] as unknown as string[];

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .set('Cookie', cookies)
        .expect(204);

      const cleared = response.headers['set-cookie'] as unknown as string[];
      expect(cleared.some((c) => c.startsWith('barff_access_token=;'))).toBe(true);

      // The refresh token from that session no longer works.
      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: session.body.refreshToken })
        .expect(401);
    });
  });

  describe('deny by default', () => {
    it('leaves health public', async () => {
      await request(app.getHttpServer()).get('/api/v1/health/live').expect(200);
    });

    it('rejects an unauthenticated call to a guarded route', async () => {
      await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
    });
  });
});
