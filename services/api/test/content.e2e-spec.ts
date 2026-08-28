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
 * S10 DoD: CRUD and public reads, and drafts never exposed publicly.
 *
 * Against the real database and the real guard chain, for the same reason the
 * products suite is: the property that matters is not "the service filters" but
 * "the route a visitor can reach filters". An unpublished announcement leaking
 * is a commercial disclosure, not a bug report.
 */
const PASSWORD = 's10-content-passphrase-2026';
const ADMIN = 's10-admin@barff.test';
const DEALER = 's10-dealer@barff.test';
const SALES = 's10-sales@barff.test';
/** Holds content:read + content:update, but deliberately NOT content:publish. */
const EDITOR = 's10-editor@barff.test';
const EDITOR_ROLE_KEY = 's10-editor-role';

/** Every row this suite creates carries it, so cleanup can be exact. */
const PREFIX = 's10t';

const prisma = new PrismaClient();

async function makeUser(email: string, roleKey: string): Promise<void> {
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

/**
 * A role with edit rights but no publish right.
 *
 * Built here rather than seeded: the point is to prove the *guard* separates
 * the two permissions, and the only honest way to check that is a principal
 * that really holds one and not the other.
 */
async function makeEditorRole(): Promise<void> {
  const role = await prisma.role.upsert({
    where: { key: EDITOR_ROLE_KEY },
    update: {},
    create: { key: EDITOR_ROLE_KEY, name: 'S10 test editor', isSystem: false },
  });
  const permissions = await prisma.permission.findMany({
    where: { key: { in: ['content:read', 'content:update'] } },
  });
  expect(permissions).toHaveLength(2);
  for (const permission of permissions) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
      update: {},
      create: { roleId: role.id, permissionId: permission.id },
    });
  }
}

const text = (base: string) => ({ uz: base, ru: base, en: base });

describe('content (e2e)', () => {
  let app: INestApplication;
  const tokens: Record<'admin' | 'dealer' | 'sales' | 'editor', string> = {
    admin: '',
    dealer: '',
    sales: '',
    editor: '',
  };
  let imageAssetId = '';
  let documentAssetId = '';

  const http = () => request(app.getHttpServer());
  const auth = (key: keyof typeof tokens = 'admin') => `Bearer ${tokens[key]}`;

  beforeAll(async () => {
    await makeEditorRole();
    await makeUser(ADMIN, Role.ADMIN);
    await makeUser(DEALER, Role.DEALER);
    await makeUser(SALES, Role.SALES);
    await makeUser(EDITOR, EDITOR_ROLE_KEY);

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app, app.get(AppConfigService));
    await app.init();

    for (const [key, email] of [
      ['admin', ADMIN],
      ['dealer', DEALER],
      ['sales', SALES],
      ['editor', EDITOR],
    ] as const) {
      const response = await http()
        .post('/api/v1/auth/login')
        .set('X-Token-Delivery', 'body')
        .send({ email, password: PASSWORD })
        .expect(200);
      tokens[key] = response.body.accessToken as string;
    }

    const image = await prisma.mediaAsset.create({
      data: {
        storageKey: `${PREFIX}/image.jpg`,
        bucket: 'test',
        originalFilename: 'image.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 10,
        checksum: 'a'.repeat(64),
        kind: 'IMAGE',
        altText: text('Zavod'),
      },
    });
    imageAssetId = image.id;

    const document = await prisma.mediaAsset.create({
      data: {
        storageKey: `${PREFIX}/doc.pdf`,
        bucket: 'test',
        originalFilename: 'doc.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 10,
        checksum: 'b'.repeat(64),
        kind: 'DOCUMENT',
      },
    });
    documentAssetId = document.id;
  });

  afterAll(async () => {
    await app?.close();
    await prisma.newsArticle.deleteMany({ where: { slug: { startsWith: PREFIX } } });
    await prisma.galleryItem.deleteMany({ where: { mediaAssetId: { in: [imageAssetId] } } });
    await prisma.publicDocument.deleteMany({ where: { mediaAssetId: { in: [documentAssetId] } } });
    await prisma.certificate.deleteMany({ where: { issuer: { startsWith: PREFIX } } });
    await prisma.pageSection.deleteMany({ where: { key: { startsWith: PREFIX } } });
    await prisma.seoMetadata.deleteMany({ where: { path: { startsWith: `/${PREFIX}` } } });
    await prisma.mediaAsset.deleteMany({ where: { storageKey: { startsWith: PREFIX } } });
    await prisma.auditLog.deleteMany({ where: { actorEmail: { startsWith: 's10-' } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: 's10-' } } });
    await prisma.role.deleteMany({ where: { key: EDITOR_ROLE_KEY } });
    await prisma.$disconnect();
  });

  async function createArticle(slug: string): Promise<string> {
    const response = await http()
      .post('/api/v1/admin/news')
      .set('Authorization', auth())
      .send({ slug, title: text(slug) })
      .expect(201);
    return response.body.id as string;
  }

  const publish = (path: string, id: string, key: keyof typeof tokens = 'admin') =>
    http().post(`/api/v1/admin/${path}/${id}/publish`).set('Authorization', auth(key));

  // -------------------------------------------------------------------------

  describe('authorization', () => {
    const ADMIN_ROUTES = [
      'admin/news',
      'admin/certificates',
      'admin/gallery',
      'admin/documents',
      'admin/page-sections',
      'admin/production-steps',
      'admin/seo',
      'admin/settings',
    ];

    it('refuses every admin route without a token', async () => {
      for (const route of ADMIN_ROUTES) {
        await http().get(`/api/v1/${route}`).expect(401);
      }
    });

    it('refuses a dealer and a sales account, who hold no content permission', async () => {
      for (const route of ADMIN_ROUTES) {
        await http().get(`/api/v1/${route}`).set('Authorization', auth('dealer')).expect(403);
        await http().get(`/api/v1/${route}`).set('Authorization', auth('sales')).expect(403);
      }
    });

    it('lets an admin read them all', async () => {
      for (const route of ADMIN_ROUTES) {
        await http().get(`/api/v1/${route}`).set('Authorization', auth()).expect(200);
      }
    });

    it('separates editing from publishing', async () => {
      const id = await createArticle(`${PREFIX}-permission-split`);

      // The editor role holds content:read and content:update.
      await http()
        .patch(`/api/v1/admin/news/${id}`)
        .set('Authorization', auth('editor'))
        .send({ title: text('Edited by the editor') })
        .expect(200);

      // It does not hold content:publish, and no edit payload can stand in for
      // it: `isActive` is not a field on the update DTO at all.
      await publish('news', id, 'editor').expect(403);
      await http()
        .patch(`/api/v1/admin/news/${id}`)
        .set('Authorization', auth('editor'))
        .send({ isActive: true })
        .expect(400);

      const row = await prisma.newsArticle.findUniqueOrThrow({ where: { id } });
      expect(row.isActive).toBe(false);
      expect(row.publishedAt).toBeNull();
    });

    it('serves every public content route with no token', async () => {
      for (const route of [
        'news',
        'content/certificates',
        'content/gallery',
        'content/documents',
        'content/production-steps',
        'content/settings',
        'content/sections/home',
      ]) {
        await http().get(`/api/v1/${route}`).expect(200);
      }
    });
  });

  describe('validation', () => {
    it('rejects a slug that is not a slug', async () => {
      for (const slug of ['Yangilik', '-x', 'x-', 'a--b', 'a b', '']) {
        await http()
          .post('/api/v1/admin/news')
          .set('Authorization', auth())
          .send({ slug, title: text('x') })
          .expect(400);
      }
    });

    it('requires all three locales for a title', async () => {
      await http()
        .post('/api/v1/admin/news')
        .set('Authorization', auth())
        .send({ slug: `${PREFIX}-partial`, title: { uz: 'Faqat', ru: 'Только' } })
        .expect(400);
    });

    it('rejects an unknown field rather than ignoring it', async () => {
      await http()
        .post('/api/v1/admin/news')
        .set('Authorization', auth())
        .send({ slug: `${PREFIX}-unknown`, title: text('x'), published: true })
        .expect(400);
    });

    it('refuses an absolute URL as a call-to-action target', async () => {
      // A CMS field that accepts `https://…` is an open redirect with a nice
      // admin form in front of it.
      for (const ctaHref of [
        'https://evil.example/phish',
        '//evil.example',
        'javascript:alert(1)',
        'http://barff.uz/x',
      ]) {
        await http()
          .post('/api/v1/admin/page-sections')
          .set('Authorization', auth())
          .send({
            page: 'home',
            key: `${PREFIX}-cta`,
            type: 'CTA',
            ctaHref,
          })
          .expect(400);
      }
    });

    it('refuses an absolute path for an SEO override', async () => {
      await http()
        .put('/api/v1/admin/seo')
        .set('Authorization', auth())
        .send({ path: 'https://barff.uz/products' })
        .expect(400);
    });

    it('refuses a page that does not exist', async () => {
      const response = await http().get('/api/v1/content/sections/dashboard').expect(400);
      expect(response.body.code).toBe('UNKNOWN_PAGE');

      await http()
        .post('/api/v1/admin/page-sections')
        .set('Authorization', auth())
        .send({ page: 'dashboard', key: `${PREFIX}-x`, type: 'HERO' })
        .expect(400);
    });

    it('refuses a media asset of the wrong kind', async () => {
      const gallery = await http()
        .post('/api/v1/admin/gallery')
        .set('Authorization', auth())
        .send({ mediaAssetId: documentAssetId })
        .expect(400);
      expect(gallery.body.code).toBe('MEDIA_KIND_MISMATCH');

      const document = await http()
        .post('/api/v1/admin/documents')
        .set('Authorization', auth())
        .send({ title: text('Katalog'), kind: 'CATALOG', mediaAssetId: imageAssetId })
        .expect(400);
      expect(document.body.code).toBe('MEDIA_KIND_MISMATCH');
    });

    it('refuses an unknown enum value', async () => {
      await http()
        .post('/api/v1/admin/gallery')
        .set('Authorization', auth())
        .send({ mediaAssetId: imageAssetId, category: 'CANTEEN' })
        .expect(400);
      await http()
        .post('/api/v1/admin/documents')
        .set('Authorization', auth())
        .send({ title: text('x'), kind: 'INVOICE', mediaAssetId: documentAssetId })
        .expect(400);
    });

    it('refuses a setting that was never declared', async () => {
      const response = await http()
        .patch('/api/v1/admin/settings/orders.auto_confirm_everything')
        .set('Authorization', auth())
        .send({ value: true })
        .expect(404);
      expect(response.body.code).toBe('SETTING_NOT_FOUND');
    });

    it('offers no way to create or delete a production stage', async () => {
      // The eight stages come from the specification. A CMS that can add a
      // ninth can publish a process BARFF does not run.
      await http()
        .post('/api/v1/admin/production-steps')
        .set('Authorization', auth())
        .send({ key: 'qoshimcha', name: text('Qo‘shimcha') })
        .expect(404);

      const steps = await prisma.productionStep.findMany();
      await http()
        .delete(`/api/v1/admin/production-steps/${steps[0]?.id ?? ''}`)
        .set('Authorization', auth())
        .expect(404);
    });
  });

  describe('slug uniqueness', () => {
    it('refuses a duplicate slug', async () => {
      await createArticle(`${PREFIX}-unique`);
      const conflict = await http()
        .post('/api/v1/admin/news')
        .set('Authorization', auth())
        .send({ slug: `${PREFIX}-unique`, title: text('other') })
        .expect(409);
      expect(conflict.body.code).toBe('SLUG_TAKEN');
    });

    it('keeps a slug reserved after the article is deleted', async () => {
      const id = await createArticle(`${PREFIX}-retired`);
      await http().delete(`/api/v1/admin/news/${id}`).set('Authorization', auth()).expect(204);

      const conflict = await http()
        .post('/api/v1/admin/news')
        .set('Authorization', auth())
        .send({ slug: `${PREFIX}-retired`, title: text('replacement') })
        .expect(409);
      expect(conflict.body.code).toBe('SLUG_TAKEN');
    });

    it('refuses two sections with the same key on one page', async () => {
      await http()
        .post('/api/v1/admin/page-sections')
        .set('Authorization', auth())
        .send({ page: 'company', key: `${PREFIX}-dup`, type: 'RICH_TEXT' })
        .expect(201);

      const conflict = await http()
        .post('/api/v1/admin/page-sections')
        .set('Authorization', auth())
        .send({ page: 'company', key: `${PREFIX}-dup`, type: 'HERO' })
        .expect(409);
      expect(conflict.body.code).toBe('SECTION_KEY_TAKEN');

      // The same key on a different page is fine — it is scoped per page.
      await http()
        .post('/api/v1/admin/page-sections')
        .set('Authorization', auth())
        .send({ page: 'partners', key: `${PREFIX}-dup`, type: 'RICH_TEXT' })
        .expect(201);
    });
  });

  describe('the public API never shows a draft', () => {
    it('hides an unpublished article from the listing and from its own URL', async () => {
      const slug = `${PREFIX}-draft`;
      await createArticle(slug);

      const list = await http().get('/api/v1/news?pageSize=100').expect(200);
      expect((list.body.items as { slug: string }[]).map((i) => i.slug)).not.toContain(slug);

      await http().get(`/api/v1/news/${slug}`).expect(404);
    });

    it('answers identically for a draft and for a slug that never existed', async () => {
      const draft = await http().get(`/api/v1/news/${PREFIX}-draft`).expect(404);
      const missing = await http().get(`/api/v1/news/${PREFIX}-no-such-thing`).expect(404);

      expect(draft.body.code).toBe(missing.body.code);
      expect(draft.body.message).toBe(missing.body.message);
    });

    it('has no query parameter that asks for one', async () => {
      for (const query of [
        'isActive=true',
        'isActive=false',
        'includeDrafts=1',
        'deletedAt=null',
      ]) {
        await http().get(`/api/v1/news?${query}`).expect(400);
        await http().get(`/api/v1/content/gallery?${query}`).expect(400);
        await http().get(`/api/v1/content/documents?${query}`).expect(400);
      }
    });

    it('shows the article once published, and stamps publishedAt once', async () => {
      const slug = `${PREFIX}-publish-me`;
      const id = await createArticle(slug);
      await http().get(`/api/v1/news/${slug}`).expect(404);

      const published = await publish('news', id).expect(201);
      expect(published.body.publishedAt).not.toBeNull();
      await http().get(`/api/v1/news/${slug}`).expect(200);

      await http()
        .patch(`/api/v1/admin/news/${id}`)
        .set('Authorization', auth())
        .send({ excerpt: text('Tuzatilgan') })
        .expect(200);

      // Re-saving must not move the publication date: it is shown to readers
      // and it is what the feed is ordered by.
      const after = await prisma.newsArticle.findUniqueOrThrow({ where: { id } });
      expect(after.publishedAt?.toISOString()).toBe(published.body.publishedAt);
    });

    it('hides it again when it is unpublished, and when it is deleted', async () => {
      const slug = `${PREFIX}-retract`;
      const id = await createArticle(slug);
      await publish('news', id).expect(201);
      await http().get(`/api/v1/news/${slug}`).expect(200);

      await http()
        .post(`/api/v1/admin/news/${id}/unpublish`)
        .set('Authorization', auth())
        .expect(201);
      await http().get(`/api/v1/news/${slug}`).expect(404);

      await publish('news', id).expect(201);
      await http().get(`/api/v1/news/${slug}`).expect(200);

      await http().delete(`/api/v1/admin/news/${id}`).set('Authorization', auth()).expect(204);
      await http().get(`/api/v1/news/${slug}`).expect(404);

      // Soft delete: the row survives so the slug stays reserved.
      const row = await prisma.newsArticle.findUniqueOrThrow({ where: { id } });
      expect(row.deletedAt).not.toBeNull();
      expect(row.isActive).toBe(false);
    });

    it('hides a draft certificate, gallery item, document and section', async () => {
      const certificate = await http()
        .post('/api/v1/admin/certificates')
        .set('Authorization', auth())
        .send({ title: text(`${PREFIX} sertifikat`), issuer: `${PREFIX}-issuer` })
        .expect(201);
      const gallery = await http()
        .post('/api/v1/admin/gallery')
        .set('Authorization', auth())
        .send({ mediaAssetId: imageAssetId, category: 'FACTORY', title: text(`${PREFIX} rasm`) })
        .expect(201);
      const document = await http()
        .post('/api/v1/admin/documents')
        .set('Authorization', auth())
        .send({ title: text(`${PREFIX} katalog`), kind: 'CATALOG', mediaAssetId: documentAssetId })
        .expect(201);
      const section = await http()
        .post('/api/v1/admin/page-sections')
        .set('Authorization', auth())
        .send({ page: 'quality', key: `${PREFIX}-block`, type: 'RICH_TEXT' })
        .expect(201);

      const ids = {
        certificate: certificate.body.id as string,
        gallery: gallery.body.id as string,
        document: document.body.id as string,
        section: section.body.id as string,
      };

      const publicIds = async () => ({
        certificates: (
          (await http().get('/api/v1/content/certificates').expect(200)).body as {
            id: string;
          }[]
        ).map((row) => row.id),
        gallery: (
          (await http().get('/api/v1/content/gallery?pageSize=100').expect(200)).body.items as {
            id: string;
          }[]
        ).map((row) => row.id),
        documents: (
          (await http().get('/api/v1/content/documents').expect(200)).body as {
            id: string;
          }[]
        ).map((row) => row.id),
        sections: (
          (await http().get('/api/v1/content/sections/quality').expect(200)).body as {
            key: string;
          }[]
        ).map((row) => row.key),
      });

      const before = await publicIds();
      expect(before.certificates).not.toContain(ids.certificate);
      expect(before.gallery).not.toContain(ids.gallery);
      expect(before.documents).not.toContain(ids.document);
      expect(before.sections).not.toContain(`${PREFIX}-block`);

      await publish('certificates', ids.certificate).expect(201);
      await publish('gallery', ids.gallery).expect(201);
      await publish('documents', ids.document).expect(201);
      await publish('page-sections', ids.section).expect(201);

      const after = await publicIds();
      expect(after.certificates).toContain(ids.certificate);
      expect(after.gallery).toContain(ids.gallery);
      expect(after.documents).toContain(ids.document);
      expect(after.sections).toContain(`${PREFIX}-block`);
    });

    it('hides a production stage that has been switched off', async () => {
      const steps = await prisma.productionStep.findMany({ orderBy: { displayOrder: 'asc' } });
      const target = steps.at(-1);
      expect(target).toBeDefined();

      const listedKeys = async () =>
        (
          (await http().get('/api/v1/content/production-steps').expect(200)).body as {
            key: string;
          }[]
        ).map((row) => row.key);

      expect(await listedKeys()).toContain(target?.key);

      await http()
        .post(`/api/v1/admin/production-steps/${target?.id ?? ''}/unpublish`)
        .set('Authorization', auth())
        .expect(201);
      expect(await listedKeys()).not.toContain(target?.key);

      await http()
        .post(`/api/v1/admin/production-steps/${target?.id ?? ''}/publish`)
        .set('Authorization', auth())
        .expect(201);
      expect(await listedKeys()).toContain(target?.key);
    });

    it('never returns an admin-only field on public content', async () => {
      const slug = `${PREFIX}-shape`;
      const id = await createArticle(slug);
      await publish('news', id).expect(201);

      const article = await http().get(`/api/v1/news/${slug}`).expect(200);
      for (const field of ['isActive', 'deletedAt', 'createdAt', 'updatedAt', 'coverImageId']) {
        expect(article.body).not.toHaveProperty(field);
      }
    });
  });

  describe('settings', () => {
    it('exposes only the settings flagged public', async () => {
      const publicView = (await http().get('/api/v1/content/settings').expect(200)).body as Record<
        string,
        unknown
      >;
      const all = await prisma.systemSetting.findMany();
      const privateKeys = all.filter((row) => !row.isPublic).map((row) => row.key);

      expect(Object.keys(publicView).length).toBeGreaterThan(0);
      for (const key of privateKeys) {
        expect(publicView).not.toHaveProperty(key);
      }
    });

    it('records the before and after of a change', async () => {
      const before = await prisma.systemSetting.findUniqueOrThrow({
        where: { key: 'site.maintenance_mode' },
      });

      await http()
        .patch('/api/v1/admin/settings/site.maintenance_mode')
        .set('Authorization', auth())
        .send({ value: true })
        .expect(200);

      const row = await prisma.auditLog.findFirst({
        where: { entity: 'SystemSetting', action: 'system_setting.updated', actorEmail: ADMIN },
        orderBy: { createdAt: 'desc' },
      });
      expect(row?.before).toMatchObject({ value: before.value });
      expect(row?.after).toMatchObject({ value: true });

      // Put it back — the maintenance flag is shared state for the whole suite.
      await http()
        .patch('/api/v1/admin/settings/site.maintenance_mode')
        .set('Authorization', auth())
        .send({ value: before.value })
        .expect(200);
    });
  });

  describe('seo overrides', () => {
    it('normalizes a path so one page cannot have two rows', async () => {
      const first = await http()
        .put('/api/v1/admin/seo')
        .set('Authorization', auth())
        .send({ path: `/${PREFIX}-page`, title: text('Birinchi') })
        .expect(200);

      const second = await http()
        .put('/api/v1/admin/seo')
        .set('Authorization', auth())
        .send({ path: `/${PREFIX}-page/`, title: text('Ikkinchi') })
        .expect(200);

      expect(second.body.id).toBe(first.body.id);
      expect(
        await prisma.seoMetadata.count({ where: { path: { startsWith: `/${PREFIX}-page` } } }),
      ).toBe(1);
    });

    it('resolves a locale-prefixed path to the same override', async () => {
      const direct = await http()
        .get('/api/v1/content/seo')
        .query({ path: `/${PREFIX}-page` })
        .expect(200);
      const prefixed = await http()
        .get('/api/v1/content/seo')
        .query({ path: `/uz/${PREFIX}-page` })
        .expect(200);

      expect(prefixed.body).toEqual(direct.body);
      expect(direct.body.path).toBe(`/${PREFIX}-page`);
    });

    it('returns null for a route with no override', async () => {
      const response = await http()
        .get('/api/v1/content/seo')
        .query({ path: `/${PREFIX}-nothing-here` })
        .expect(200);
      expect(response.body).toEqual({});
    });

    it('removes an override so the route falls back to defaults', async () => {
      const row = await prisma.seoMetadata.findUniqueOrThrow({
        where: { path: `/${PREFIX}-page` },
      });
      await http().delete(`/api/v1/admin/seo/${row.id}`).set('Authorization', auth()).expect(204);

      const response = await http()
        .get('/api/v1/content/seo')
        .query({ path: `/${PREFIX}-page` })
        .expect(200);
      expect(response.body).toEqual({});
    });
  });

  describe('audit', () => {
    it('records who published an article, separately from who edited it', async () => {
      const id = await createArticle(`${PREFIX}-audited`);
      await http()
        .patch(`/api/v1/admin/news/${id}`)
        .set('Authorization', auth('editor'))
        .send({ title: text('Tahrirlangan') })
        .expect(200);
      await publish('news', id).expect(201);

      const rows = await prisma.auditLog.findMany({
        where: { entity: 'NewsArticle', entityId: id },
        orderBy: { createdAt: 'asc' },
      });

      expect(rows.map((row) => row.action)).toEqual([
        'news.created',
        'news.updated',
        'news.published',
      ]);
      expect(rows.map((row) => row.actorEmail)).toEqual([ADMIN, EDITOR, ADMIN]);
    });
  });
});
