import { rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import sharp from 'sharp';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Role } from '@barff/types';
import { PrismaClient } from '../generated/prisma/index.js';
import { AppModule } from '../src/app.module.js';
import { AppConfigService } from '../src/common/config/app-config.service.js';
import { configureApp } from '../src/bootstrap.js';
import { hashPassword } from '../src/common/crypto/password.js';

/**
 * `ConfigModule.forRoot()` is evaluated when the module graph is imported, so
 * the storage settings have to be in place before the imports above run —
 * `beforeAll` would be too late.
 *
 * The filesystem provider is used deliberately: this suite is about the
 * pipeline and the HTTP contract. The S3 adapter has its own suite, run against
 * a real S3-compatible server.
 */
const STORAGE_ROOT = '.media-e2e-test';
vi.hoisted(() => {
  process.env['STORAGE_PROVIDER'] = 'filesystem';
  process.env['MEDIA_FILESYSTEM_ROOT'] = '.media-e2e-test';
  process.env['MEDIA_MAX_UPLOAD_BYTES'] = String(2 * 1024 * 1024);
});

const PASSWORD = 'media-e2e-passphrase-2026';
const ADMIN = 's08-admin@barff.test';
const DEALER = 's08-dealer@barff.test';

const prisma = new PrismaClient();

async function makeUser(email: string, roleKey: Role): Promise<void> {
  const role = await prisma.role.findUniqueOrThrow({ where: { key: roleKey } });
  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash: await hashPassword(PASSWORD), isActive: true },
    create: { email, passwordHash: await hashPassword(PASSWORD) },
  });
  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: role.id } },
    update: {},
    create: { userId: user.id, roleId: role.id },
  });
}

const png = (w: number, h: number) =>
  sharp({ create: { width: w, height: h, channels: 3, background: { r: 46, g: 182, b: 106 } } })
    .png()
    .toBuffer();

describe('media (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let dealerToken: string;

  beforeAll(async () => {
    await makeUser(ADMIN, Role.ADMIN);
    await makeUser(DEALER, Role.DEALER);

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app, app.get(AppConfigService));
    await app.init();

    for (const [email, assign] of [
      [ADMIN, (t: string) => (adminToken = t)],
      [DEALER, (t: string) => (dealerToken = t)],
    ] as const) {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('X-Token-Delivery', 'body')
        .send({ email, password: PASSWORD })
        .expect(200);
      assign(response.body.accessToken as string);
    }
  }, 60_000);

  afterAll(async () => {
    await app?.close();
    await prisma.auditLog.deleteMany({ where: { actorEmail: { startsWith: 's08-' } } });
    await prisma.mediaAsset.deleteMany({ where: { originalFilename: { startsWith: 's08-' } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: 's08-' } } });
    await prisma.$disconnect();
    await rm(resolve(STORAGE_ROOT), { recursive: true, force: true });
  });

  const upload = (token: string) =>
    request(app.getHttpServer()).post('/api/v1/media').set('Authorization', `Bearer ${token}`);

  describe('authorization', () => {
    it('rejects an unauthenticated upload', async () => {
      await request(app.getHttpServer()).post('/api/v1/media').expect(401);
    });

    it('rejects a dealer, who holds no media permission', async () => {
      const response = await upload(dealerToken)
        .attach('file', await png(50, 50), 's08-nope.png')
        .expect(403);
      expect(response.body.code).toBe('FORBIDDEN_PERMISSION');
    });
  });

  describe('upload', () => {
    it('stores an image, derives variants and a blur placeholder', async () => {
      const response = await upload(adminToken)
        .attach('file', await png(1400, 1000), 's08-product.png')
        .expect(201);

      expect(response.body.kind).toBe('IMAGE');
      // Re-encoded, so the stored type is not the uploaded one.
      expect(response.body.mimeType).toBe('image/webp');
      expect(response.body.width).toBe(1400);
      expect(response.body.height).toBe(1000);
      expect(response.body.blurDataUrl).toMatch(/^data:image\/webp;base64,/);
      expect(response.body.variants.length).toBeGreaterThan(0);
      expect(response.body.variants.some((v: { label: string }) => v.label.endsWith('.avif'))).toBe(
        true,
      );
    }, 60_000);

    it('defaults to private, and private assets get a signed URL', async () => {
      const response = await upload(adminToken)
        .attach('file', await png(300, 300), 's08-private.png')
        .expect(201);

      // A caller that says nothing about visibility gets the safe option.
      expect(response.body.visibility).toBe('PRIVATE');
      expect(response.body.url).toContain('signature=');
      expect(response.body.url).toContain('expires=');
    }, 30_000);

    it('accepts a PDF as a document', async () => {
      const pdf = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\ntrailer\n%%EOF\n', 'utf8');
      const response = await upload(adminToken)
        .attach('file', pdf, 's08-certificate.pdf')
        .expect(201);

      expect(response.body.kind).toBe('DOCUMENT');
      expect(response.body.mimeType).toBe('application/pdf');
      // Documents are stored as-is; only images get renditions.
      expect(response.body.variants).toEqual([]);
    });

    it('writes an audit row', async () => {
      await upload(adminToken)
        .attach('file', await png(60, 60), 's08-audited.png')
        .expect(201);
      const entry = await prisma.auditLog.findFirst({
        where: { action: 'media.uploaded', actorEmail: ADMIN },
        orderBy: { createdAt: 'desc' },
      });
      expect(entry).not.toBeNull();
    }, 30_000);

    it('requires a file', async () => {
      const response = await upload(adminToken).expect(400);
      expect(response.body.code).toBe('MEDIA_FILE_REQUIRED');
    });
  });

  describe('rejections', () => {
    it('rejects a spoofed file — a script named .png', async () => {
      // The §20 case: the extension and the Content-Type both say image.
      const shell = Buffer.from('#!/bin/sh\nrm -rf /\n', 'utf8');
      const response = await upload(adminToken)
        .attach('file', shell, { filename: 's08-evil.png', contentType: 'image/png' })
        .expect(415);
      expect(response.body.code).toBe('MEDIA_UNSUPPORTED_TYPE');
    });

    it('rejects SVG even though it is an image format', async () => {
      const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>', 'utf8');
      await upload(adminToken)
        .attach('file', svg, { filename: 's08-logo.svg', contentType: 'image/svg+xml' })
        .expect(415);
    });

    it('rejects an oversized file', async () => {
      // Over the 2MB limit set for this suite. Multer refuses it as it
      // streams, so the body is never fully buffered.
      const huge = Buffer.alloc(3 * 1024 * 1024, 0x41);
      const response = await upload(adminToken).attach('file', huge, 's08-huge.png');
      expect([400, 413]).toContain(response.status);
    }, 30_000);

    it('records the rejection in the audit log', async () => {
      await upload(adminToken)
        .attach('file', Buffer.from('GIF89a', 'ascii'), 's08-old.gif')
        .expect(415);
      const entry = await prisma.auditLog.findFirst({
        where: { action: 'media.rejected', actorEmail: ADMIN },
        orderBy: { createdAt: 'desc' },
      });
      expect(entry).not.toBeNull();
      expect((entry?.after as Record<string, unknown>)['reason']).toBe('unsupported_type');
    });
  });

  describe('list and read', () => {
    it('paginates', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/media?pageSize=2')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.items.length).toBeLessThanOrEqual(2);
      expect(response.body.meta.pageSize).toBe(2);
    });

    it('filters by kind', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/media?kind=DOCUMENT')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      for (const item of response.body.items) expect(item.kind).toBe('DOCUMENT');
    });

    it('404s for an unknown id', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/media/00000000-0000-4000-8000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
      expect(response.body.code).toBe('MEDIA_NOT_FOUND');
    });
  });

  describe('replace', () => {
    it('keeps the id and swaps the content', async () => {
      const created = await upload(adminToken)
        .attach('file', await png(400, 400), 's08-before.png')
        .expect(201);

      const replaced = await request(app.getHttpServer())
        .put(`/api/v1/media/${created.body.id}/file`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', await png(800, 600), 's08-after.png')
        .expect(200);

      // The id is what products reference — replacing must not change it.
      expect(replaced.body.id).toBe(created.body.id);
      expect(replaced.body.width).toBe(800);
      expect(replaced.body.originalFilename).toBe('s08-after.png');
    }, 60_000);

    it('refuses to swap a document in for an image', async () => {
      const created = await upload(adminToken)
        .attach('file', await png(200, 200), 's08-kind.png')
        .expect(201);

      const pdf = Buffer.from('%PDF-1.7\n%%EOF\n', 'utf8');
      const response = await request(app.getHttpServer())
        .put(`/api/v1/media/${created.body.id}/file`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('file', pdf, 's08-kind.pdf')
        .expect(400);

      expect(response.body.code).toBe('MEDIA_KIND_MISMATCH');
    }, 30_000);
  });

  describe('delete', () => {
    it('removes the asset and stops serving it', async () => {
      const created = await upload(adminToken)
        .attach('file', await png(250, 250), 's08-doomed.png')
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/api/v1/media/${created.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      await request(app.getHttpServer())
        .get(`/api/v1/media/${created.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    }, 30_000);

    it('rejects a dealer', async () => {
      const created = await upload(adminToken)
        .attach('file', await png(120, 120), 's08-guarded.png')
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/api/v1/media/${created.body.id}`)
        .set('Authorization', `Bearer ${dealerToken}`)
        .expect(403);
    }, 30_000);
  });
});
