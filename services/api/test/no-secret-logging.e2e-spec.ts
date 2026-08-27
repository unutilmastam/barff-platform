import { Writable } from 'node:stream';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Role } from '@barff/types';
import { AppModule } from '../src/app.module.js';
import { AppConfigService } from '../src/common/config/app-config.service.js';
import { configureApp } from '../src/bootstrap.js';
import { hashPassword } from '../src/common/crypto/password.js';
import { StructuredLogger } from '../src/common/logger/structured-logger.service.js';

/**
 * "No token or password is ever logged" (`CLAUDE.md` §12, S04 DoD).
 *
 * Asserted rather than assumed: this is the kind of guarantee that holds until
 * someone adds a `logger.debug(body)` while debugging and forgets to remove it.
 * The app runs against a capturing logger at `debug` level — the noisiest
 * setting, so anything that would ever be written is written here — and the
 * whole transcript is searched for the actual secrets used.
 */
const EMAIL = 's04log-user@barff.test';
const PASSWORD = 'a-very-distinctive-passphrase-9417';

const prisma = new PrismaClient();

describe('secrets never reach the logs (e2e)', () => {
  let app: INestApplication;
  let logOutput = '';

  beforeAll(async () => {
    const role = await prisma.role.findUniqueOrThrow({ where: { key: Role.DEALER } });
    const user = await prisma.user.upsert({
      where: { email: EMAIL },
      update: { passwordHash: await hashPassword(PASSWORD), isActive: true },
      create: { email: EMAIL, passwordHash: await hashPassword(PASSWORD) },
    });
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      update: {},
      create: { userId: user.id, roleId: role.id },
    });

    const capture = new Writable({
      write(chunk, _encoding, callback) {
        logOutput += String(chunk);
        callback();
      },
    });

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({
      logger: new StructuredLogger('debug', undefined, capture),
    });
    configureApp(app, app.get(AppConfigService));
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await prisma.auditLog.deleteMany({ where: { actorEmail: EMAIL } });
    await prisma.user.deleteMany({ where: { email: EMAIL } });
    await prisma.$disconnect();
  });

  it('logs nothing sensitive across login, refresh, failure and a guarded call', async () => {
    const session = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('X-Token-Delivery', 'body')
      .send({ email: EMAIL, password: PASSWORD })
      .expect(200);

    const accessToken = session.body.accessToken as string;
    const refreshToken = session.body.refreshToken as string;

    // Exercise the paths most likely to log a request body or a credential.
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: EMAIL, password: 'wrong-password-8823' })
      .expect(401);

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('X-Token-Delivery', 'body')
      .send({ refreshToken })
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer tampered.token.value')
      .expect(401);

    expect(logOutput.length).toBeGreaterThan(0);

    expect(logOutput).not.toContain(PASSWORD);
    expect(logOutput).not.toContain('wrong-password-8823');
    expect(logOutput).not.toContain(accessToken);
    expect(logOutput).not.toContain(refreshToken);
    // Neither the hash itself nor any argon2 material.
    expect(logOutput).not.toContain('$argon2');
  });

  it('does not log the password hash when a user record is handled', async () => {
    const user = await prisma.user.findUniqueOrThrow({ where: { email: EMAIL } });
    expect(logOutput).not.toContain(user.passwordHash);
  });
});
