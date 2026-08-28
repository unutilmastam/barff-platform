import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Role } from '@barff/types';
import { PrismaClient } from '../generated/prisma/index.js';
import { AppModule } from '../src/app.module.js';
import { AppConfigService } from '../src/common/config/app-config.service.js';
import { configureApp } from '../src/bootstrap.js';
import { hashPassword } from '../src/common/crypto/password.js';

/**
 * S11 DoD: cache hit/miss, and an admin edit invalidating within one request
 * cycle.
 *
 * Against a real Redis. A mocked cache would only prove the interceptor calls
 * the methods it was written to call — it could not catch a key that is not
 * stable, a generation counter that is never read, or an invalidation that
 * races the response.
 */
const PASSWORD = 's11-cache-passphrase-2026';
const ADMIN = 's11-admin@barff.test';
const DEALER = 's11-dealer@barff.test';
const PREFIX = 's11t';

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

const text = (base: string) => ({ uz: base, ru: base, en: base });

describe('public API caching (e2e)', () => {
  let app: INestApplication;
  let adminToken = '';
  let dealerToken = '';

  const http = () => request(app.getHttpServer());
  const auth = () => `Bearer ${adminToken}`;

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
      const response = await http()
        .post('/api/v1/auth/login')
        .set('X-Token-Delivery', 'body')
        .send({ email, password: PASSWORD })
        .expect(200);
      assign(response.body.accessToken as string);
    }
  });

  afterAll(async () => {
    await app?.close();
    await prisma.newsArticle.deleteMany({ where: { slug: { startsWith: PREFIX } } });
    await prisma.product.deleteMany({ where: { slug: { startsWith: PREFIX } } });
    await prisma.mediaAsset.deleteMany({ where: { storageKey: { startsWith: PREFIX } } });
    await prisma.auditLog.deleteMany({ where: { actorEmail: { startsWith: 's11-' } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: 's11-' } } });
    await prisma.$disconnect();
  });

  /** Publishes a news article and returns its slug and id. */
  async function publishedArticle(name: string): Promise<{ id: string; slug: string }> {
    const slug = `${PREFIX}-${name}`;
    const created = await http()
      .post('/api/v1/admin/news')
      .set('Authorization', auth())
      .send({ slug, title: text(slug) })
      .expect(201);
    const id = created.body.id as string;
    await http().post(`/api/v1/admin/news/${id}/publish`).set('Authorization', auth()).expect(201);
    return { id, slug };
  }

  describe('hit and miss', () => {
    it('serves the second identical request from the cache', async () => {
      const { slug } = await publishedArticle('hit-miss');

      const first = await http().get(`/api/v1/news/${slug}`).expect(200);
      expect(first.headers['x-cache']).toBe('MISS');

      const second = await http().get(`/api/v1/news/${slug}`).expect(200);
      expect(second.headers['x-cache']).toBe('HIT');
      expect(second.body).toEqual(first.body);
      expect(second.headers.etag).toBe(first.headers.etag);
    });

    it('keys on the query string, not just the path', async () => {
      await http().get('/api/v1/news?pageSize=5').expect(200);
      const repeat = await http().get('/api/v1/news?pageSize=5').expect(200);
      expect(repeat.headers['x-cache']).toBe('HIT');

      // A different page is a different response and must not be served from
      // the entry cached above.
      const other = await http().get('/api/v1/news?pageSize=6').expect(200);
      expect(other.headers['x-cache']).toBe('MISS');
    });

    it('treats reordered parameters as the same request', async () => {
      await http().get('/api/v1/products?page=1&pageSize=5').expect(200);
      const reordered = await http().get('/api/v1/products?pageSize=5&page=1').expect(200);
      expect(reordered.headers['x-cache']).toBe('HIT');
    });

    it('advertises a shared cache lifetime longer than the browser one', async () => {
      const response = await http().get('/api/v1/content/certificates').expect(200);
      const header = response.headers['cache-control'] ?? '';

      const maxAge = Number(/(?:^|[ ,])max-age=(\d+)/.exec(header)?.[1]);
      const sMaxAge = Number(/s-maxage=(\d+)/.exec(header)?.[1]);

      expect(header).toContain('public');
      expect(sMaxAge).toBeGreaterThan(0);
      expect(maxAge).toBeLessThanOrEqual(sMaxAge);
    });

    it('never caches longer than the signed media URLs it embeds', async () => {
      // The failure this guards against is invisible in the response: a cached
      // payload whose image links have expired looks perfectly valid and
      // renders as broken images.
      const signedUrlTtl = app.get(AppConfigService).storage.signedUrlTtlSeconds;
      const response = await http().get('/api/v1/products').expect(200);
      const header = response.headers['cache-control'] ?? '';

      const maxAge = Number(/(?:^|[ ,])max-age=(\d+)/.exec(header)?.[1]);
      const sMaxAge = Number(/s-maxage=(\d+)/.exec(header)?.[1]);

      expect(maxAge + sMaxAge).toBeLessThan(signedUrlTtl);
    });
  });

  describe('revalidation', () => {
    it('answers 304 with no body when the client already holds the response', async () => {
      const { slug } = await publishedArticle('etag');
      const first = await http().get(`/api/v1/news/${slug}`).expect(200);
      const etag = first.headers.etag as string;
      expect(etag).toMatch(/^"[0-9a-f]{64}"$/);

      const revalidated = await http()
        .get(`/api/v1/news/${slug}`)
        .set('If-None-Match', etag)
        .expect(304);
      expect(revalidated.text).toBeFalsy();
    });

    it('accepts an ETag a proxy has weakened', async () => {
      const { slug } = await publishedArticle('weak-etag');
      const first = await http().get(`/api/v1/news/${slug}`).expect(200);

      await http()
        .get(`/api/v1/news/${slug}`)
        .set('If-None-Match', `W/${first.headers.etag as string}`)
        .expect(304);
    });

    it('sends the body again when the client holds a stale tag', async () => {
      const { slug } = await publishedArticle('stale-etag');
      await http().get(`/api/v1/news/${slug}`).expect(200);

      const response = await http()
        .get(`/api/v1/news/${slug}`)
        .set('If-None-Match', '"0000000000000000000000000000000000000000000000000000000000000000"')
        .expect(200);
      expect(response.body.slug).toBe(slug);
    });
  });

  describe('invalidation within one request cycle', () => {
    it('serves the edit immediately after the write returns', async () => {
      const { id, slug } = await publishedArticle('invalidate');

      await http().get(`/api/v1/news/${slug}`).expect(200);
      const cached = await http().get(`/api/v1/news/${slug}`).expect(200);
      expect(cached.headers['x-cache']).toBe('HIT');

      await http()
        .patch(`/api/v1/admin/news/${id}`)
        .set('Authorization', auth())
        .send({ title: text('Yangilangan sarlavha') })
        .expect(200);

      // No sleep, no retry: the purge completes before the write's own response
      // is sent, so the very next read is a miss carrying the new content.
      const afterWrite = await http().get(`/api/v1/news/${slug}`).expect(200);
      expect(afterWrite.headers['x-cache']).toBe('MISS');
      expect(afterWrite.body.title).toEqual(text('Yangilangan sarlavha'));
      expect(afterWrite.headers.etag).not.toBe(cached.headers.etag);
    });

    it('removes an unpublished article from the cached listing at once', async () => {
      const { id, slug } = await publishedArticle('unpublish');

      await http().get('/api/v1/news?pageSize=100').expect(200);
      const cachedList = await http().get('/api/v1/news?pageSize=100').expect(200);
      expect(cachedList.headers['x-cache']).toBe('HIT');
      expect((cachedList.body.items as { slug: string }[]).map((i) => i.slug)).toContain(slug);

      await http()
        .post(`/api/v1/admin/news/${id}/unpublish`)
        .set('Authorization', auth())
        .expect(201);

      const afterList = await http().get('/api/v1/news?pageSize=100').expect(200);
      expect(afterList.headers['x-cache']).toBe('MISS');
      expect((afterList.body.items as { slug: string }[]).map((i) => i.slug)).not.toContain(slug);
    });

    it('purges only the namespace that changed', async () => {
      await http().get('/api/v1/news?pageSize=3').expect(200);
      await http().get('/api/v1/content/certificates').expect(200);

      expect((await http().get('/api/v1/news?pageSize=3')).headers['x-cache']).toBe('HIT');
      expect((await http().get('/api/v1/content/certificates')).headers['x-cache']).toBe('HIT');

      const { id } = await publishedArticle('scoped-purge');
      await http()
        .patch(`/api/v1/admin/news/${id}`)
        .set('Authorization', auth())
        .send({ excerpt: text('x') })
        .expect(200);

      expect((await http().get('/api/v1/news?pageSize=3')).headers['x-cache']).toBe('MISS');
      // Certificates were not touched, so their cache survives. Without this a
      // single edit would cold-start the whole public site.
      expect((await http().get('/api/v1/content/certificates')).headers['x-cache']).toBe('HIT');
    });

    it('purges every namespace when a media asset changes', async () => {
      await http().get('/api/v1/content/certificates').expect(200);
      expect((await http().get('/api/v1/content/certificates')).headers['x-cache']).toBe('HIT');

      const asset = await prisma.mediaAsset.create({
        data: {
          storageKey: `${PREFIX}/purge.jpg`,
          bucket: 'test',
          originalFilename: 'purge.jpg',
          mimeType: 'image/jpeg',
          sizeBytes: 10,
          checksum: 'c'.repeat(64),
          kind: 'IMAGE',
        },
      });

      await http().delete(`/api/v1/media/${asset.id}`).set('Authorization', auth()).expect(204);

      // A replaced or deleted asset can change a URL any cached page embeds,
      // and nothing records which pages referenced it.
      expect((await http().get('/api/v1/content/certificates')).headers['x-cache']).toBe('MISS');
    });
  });

  describe('nothing private is ever cacheable', () => {
    it('marks authenticated responses no-store', async () => {
      for (const [path, token] of [
        ['/api/v1/auth/me', adminToken],
        ['/api/v1/admin/news', adminToken],
        ['/api/v1/admin/products', adminToken],
        ['/api/v1/media', adminToken],
        ['/api/v1/admin/settings', adminToken],
      ] as const) {
        const response = await http().get(path).set('Authorization', `Bearer ${token}`).expect(200);
        expect(response.headers['cache-control']).toBe('no-store');
        expect(response.headers['x-cache']).toBeUndefined();
      }
    });

    it('marks a rejected request no-store too', async () => {
      // Guards run before interceptors, so this header can only come from the
      // middleware. A 403 body naming a missing permission is not something a
      // shared cache should hold either.
      const unauthorized = await http().get('/api/v1/admin/news').expect(401);
      expect(unauthorized.headers['cache-control']).toBe('no-store');

      const forbidden = await http()
        .get('/api/v1/admin/news')
        .set('Authorization', `Bearer ${dealerToken}`)
        .expect(403);
      expect(forbidden.headers['cache-control']).toBe('no-store');
    });

    it('marks a write no-store, including a public 404', async () => {
      const write = await http()
        .post('/api/v1/admin/news')
        .set('Authorization', auth())
        .send({ slug: `${PREFIX}-nostore`, title: text('x') })
        .expect(201);
      expect(write.headers['cache-control']).toBe('no-store');

      const missing = await http().get('/api/v1/news/does-not-exist-at-all').expect(404);
      // An error is never stored: one failed lookup must not become minutes of
      // 404 for a slug that is about to exist.
      expect(missing.headers['cache-control']).toBe('no-store');
    });

    it('never caches a draft, even after the published version was cached', async () => {
      const { id, slug } = await publishedArticle('draft-guard');
      await http().get(`/api/v1/news/${slug}`).expect(200);
      expect((await http().get(`/api/v1/news/${slug}`)).headers['x-cache']).toBe('HIT');

      await http()
        .post(`/api/v1/admin/news/${id}/unpublish`)
        .set('Authorization', auth())
        .expect(201);

      // The S09/S10 rule still holds through the cache layer: unpublishing has
      // to actually take the page down, not leave a cached copy serving it.
      await http().get(`/api/v1/news/${slug}`).expect(404);
    });
  });
});
