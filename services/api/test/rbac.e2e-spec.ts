import { Controller, Get, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Role } from '@barff/types';
import { AppModule } from '../src/app.module.js';
import { AppConfigService } from '../src/common/config/app-config.service.js';
import { configureApp } from '../src/bootstrap.js';
import { hashPassword } from '../src/common/crypto/password.js';
import { Public } from '../src/auth/decorators/public.decorator.js';
import { Roles } from '../src/auth/decorators/roles.decorator.js';
import { Permissions } from '../src/auth/decorators/permissions.decorator.js';
import { CurrentUser } from '../src/auth/decorators/current-user.decorator.js';
import { type AuthenticatedUser } from '../src/auth/types.js';

/**
 * RBAC against real routes and real seeded grants.
 *
 * The guards have unit tests; this proves the whole chain — token, global
 * guards, seeded role→permission data — actually refuses the request. The
 * point of §12 is that the *server* denies, so a controller is the only honest
 * place to check it.
 */
@Controller({ path: 'rbac-probe', version: '1' })
class RbacProbeController {
  @Public()
  @Get('open')
  open() {
    return { ok: true };
  }

  @Get('any-authenticated')
  authenticated(@CurrentUser() user: AuthenticatedUser) {
    return { email: user.email };
  }

  @Get('admin-only')
  @Roles(Role.ADMIN)
  adminOnly() {
    return { ok: true };
  }

  @Get('warehouse-or-logistics')
  @Roles(Role.WAREHOUSE, Role.LOGISTICS)
  warehouseOrLogistics() {
    return { ok: true };
  }

  @Get('needs-settings-update')
  @Permissions('settings:update')
  settingsUpdate() {
    return { ok: true };
  }

  @Get('needs-two-permissions')
  @Permissions('products:read', 'warehouse:adjust')
  twoPermissions() {
    return { ok: true };
  }

  @Get('dealer-readable')
  @Permissions('products:read')
  dealerReadable() {
    return { ok: true };
  }
}

const PASSWORD = 'rbac-test-passphrase-2026';
const prisma = new PrismaClient();

const ACCOUNTS: { email: string; role: Role }[] = [
  { email: 's04rbac-admin@barff.test', role: Role.ADMIN },
  { email: 's04rbac-dealer@barff.test', role: Role.DEALER },
  { email: 's04rbac-warehouse@barff.test', role: Role.WAREHOUSE },
  { email: 's04rbac-driver@barff.test', role: Role.DRIVER },
];

describe('RBAC (e2e)', () => {
  let app: INestApplication;
  const tokens = new Map<Role, string>();

  beforeAll(async () => {
    for (const account of ACCOUNTS) {
      const role = await prisma.role.findUniqueOrThrow({ where: { key: account.role } });
      const user = await prisma.user.upsert({
        where: { email: account.email },
        update: { passwordHash: await hashPassword(PASSWORD), isActive: true },
        create: { email: account.email, passwordHash: await hashPassword(PASSWORD) },
      });
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId: role.id } },
        update: {},
        create: { userId: user.id, roleId: role.id },
      });
    }

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [RbacProbeController],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app, app.get(AppConfigService));
    await app.init();

    for (const account of ACCOUNTS) {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('X-Token-Delivery', 'body')
        .send({ email: account.email, password: PASSWORD })
        .expect(200);
      tokens.set(account.role, response.body.accessToken as string);
    }
  });

  afterAll(async () => {
    await app?.close();
    await prisma.auditLog.deleteMany({ where: { actorEmail: { startsWith: 's04rbac-' } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: 's04rbac-' } } });
    await prisma.$disconnect();
  });

  const as = (role: Role, path: string) =>
    request(app.getHttpServer())
      .get(`/api/v1/rbac-probe/${path}`)
      .set('Authorization', `Bearer ${tokens.get(role) ?? ''}`);

  describe('deny by default', () => {
    it('allows an explicitly public route with no token', async () => {
      await request(app.getHttpServer()).get('/api/v1/rbac-probe/open').expect(200);
    });

    it('rejects every other route without a token', async () => {
      for (const path of ['any-authenticated', 'admin-only', 'needs-settings-update']) {
        await request(app.getHttpServer()).get(`/api/v1/rbac-probe/${path}`).expect(401);
      }
    });
  });

  describe('@Roles()', () => {
    it('admits the matching role', async () => {
      await as(Role.ADMIN, 'admin-only').expect(200);
    });

    it('refuses a different role with 403, not 401', async () => {
      // 401 would mean "authenticate"; the dealer is authenticated and simply
      // may not do this.
      const response = await as(Role.DEALER, 'admin-only').expect(403);
      expect(response.body.code).toBe('FORBIDDEN_ROLE');
    });

    it('admits any one of several accepted roles', async () => {
      await as(Role.WAREHOUSE, 'warehouse-or-logistics').expect(200);
      await as(Role.DRIVER, 'warehouse-or-logistics').expect(403);
    });

    it('lets any authenticated user through a route with no role requirement', async () => {
      await as(Role.DRIVER, 'any-authenticated').expect(200);
      await as(Role.DEALER, 'any-authenticated').expect(200);
    });
  });

  describe('@Permissions()', () => {
    it('admits a holder of the permission', async () => {
      // ADMIN is seeded with every permission.
      await as(Role.ADMIN, 'needs-settings-update').expect(200);
    });

    it('refuses a role that was never granted it', async () => {
      const response = await as(Role.WAREHOUSE, 'needs-settings-update').expect(403);
      expect(response.body.code).toBe('FORBIDDEN_PERMISSION');
    });

    it('uses the seeded grants — a dealer can read products', async () => {
      await as(Role.DEALER, 'dealer-readable').expect(200);
    });

    it('requires all listed permissions', async () => {
      // WAREHOUSE holds products:read and warehouse:adjust; DEALER holds only
      // the first, so it must be refused rather than admitted on a partial match.
      await as(Role.WAREHOUSE, 'needs-two-permissions').expect(200);
      await as(Role.DEALER, 'needs-two-permissions').expect(403);
    });

    it('does not disclose the missing permission', async () => {
      const response = await as(Role.DRIVER, 'needs-settings-update').expect(403);
      expect(JSON.stringify(response.body)).not.toContain('settings:update');
    });
  });

  describe('the frontend cannot be trusted', () => {
    it('refuses a direct call even with a perfectly valid token', async () => {
      // CLAUDE.md §3: hiding the button is cosmetic. This is the check that
      // matters, and it happens on the server.
      const response = await as(Role.DRIVER, 'admin-only').expect(403);
      expect(response.body.requestId).toBe(response.headers['x-request-id']);
    });
  });
});
