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
 * S09 DoD: validation, authorization, slug uniqueness, and the public API
 * respecting `isActive` and the soft delete.
 *
 * Run against the real database and the real guard chain. A unit test on the
 * service would prove the service filters; it would not prove that the route a
 * visitor actually reaches applies that filter, which is the property that
 * matters — a draft product leaking is a commercial disclosure, not a bug
 * report.
 */
const PASSWORD = 's09-products-passphrase-2026';
const ADMIN = 's09-admin@barff.test';
const DEALER = 's09-dealer@barff.test';
const SALES = 's09-sales@barff.test';

/** Every row this suite creates carries it, so cleanup can be exact. */
const PREFIX = 's09t';

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

const name = (base: string) => ({ uz: base, ru: base, en: base });

describe('products (e2e)', () => {
  let app: INestApplication;
  const tokens: Record<'admin' | 'dealer' | 'sales', string> = { admin: '', dealer: '', sales: '' };
  let categoryId = '';

  const http = () => request(app.getHttpServer());
  const asAdmin = () => tokens.admin;

  beforeAll(async () => {
    await makeUser(ADMIN, Role.ADMIN);
    await makeUser(DEALER, Role.DEALER);
    await makeUser(SALES, Role.SALES);

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app, app.get(AppConfigService));
    await app.init();

    for (const [key, email] of [
      ['admin', ADMIN],
      ['dealer', DEALER],
      ['sales', SALES],
    ] as const) {
      const response = await http()
        .post('/api/v1/auth/login')
        .set('X-Token-Delivery', 'body')
        .send({ email, password: PASSWORD })
        .expect(200);
      tokens[key] = response.body.accessToken as string;
    }

    const category = await http()
      .post('/api/v1/admin/product-categories')
      .set('Authorization', `Bearer ${asAdmin()}`)
      .send({ slug: `${PREFIX}-sharbatlar`, name: name('Sharbatlar') })
      .expect(201);
    categoryId = category.body.id as string;
  });

  afterAll(async () => {
    await app?.close();
    // Products cascade to variants, images and documents.
    await prisma.product.deleteMany({ where: { slug: { startsWith: PREFIX } } });
    await prisma.productCategory.deleteMany({ where: { slug: { startsWith: PREFIX } } });
    await prisma.mediaAsset.deleteMany({ where: { storageKey: { startsWith: PREFIX } } });
    await prisma.auditLog.deleteMany({ where: { actorEmail: { startsWith: 's09-' } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: 's09-' } } });
    await prisma.$disconnect();
  });

  /** Creates a product through the API and returns its id. */
  async function createProduct(
    slug: string,
    body: Record<string, unknown> = {},
  ): Promise<{ id: string }> {
    const response = await http()
      .post('/api/v1/admin/products')
      .set('Authorization', `Bearer ${asAdmin()}`)
      .send({ slug, name: name(slug), categoryId, ...body })
      .expect(201);
    return { id: response.body.id as string };
  }

  // -------------------------------------------------------------------------

  describe('authorization', () => {
    it('refuses admin product routes without a token', async () => {
      await http().get('/api/v1/admin/products').expect(401);
      await http().post('/api/v1/admin/products').send({}).expect(401);
      await http().get('/api/v1/admin/product-categories').expect(401);
    });

    it('refuses a dealer, who holds products:read but must not see drafts', async () => {
      // Dealers are granted `products:read` for the portal catalogue. The admin
      // listing returns unpublished products, so it requires
      // `products:read_all` — otherwise every dealer account could read the
      // roadmap of products BARFF has not announced.
      await http()
        .get('/api/v1/admin/products')
        .set('Authorization', `Bearer ${tokens.dealer}`)
        .expect(403);
      await http()
        .get('/api/v1/admin/product-categories')
        .set('Authorization', `Bearer ${tokens.dealer}`)
        .expect(403);
    });

    it('refuses a dealer any write', async () => {
      await http()
        .post('/api/v1/admin/products')
        .set('Authorization', `Bearer ${tokens.dealer}`)
        .send({ slug: `${PREFIX}-dealer-write`, name: name('nope') })
        .expect(403);

      expect(await prisma.product.count({ where: { slug: `${PREFIX}-dealer-write` } })).toBe(0);
    });

    it('lets sales read the admin catalogue but not write it', async () => {
      await http()
        .get('/api/v1/admin/products')
        .set('Authorization', `Bearer ${tokens.sales}`)
        .expect(200);
      await http()
        .post('/api/v1/admin/products')
        .set('Authorization', `Bearer ${tokens.sales}`)
        .send({ slug: `${PREFIX}-sales-write`, name: name('nope') })
        .expect(403);
    });

    it('serves the public catalogue with no token at all', async () => {
      await http().get('/api/v1/products').expect(200);
      await http().get('/api/v1/products/categories').expect(200);
    });
  });

  describe('validation', () => {
    it('rejects a slug that is not a slug', async () => {
      for (const slug of [
        'Granat',
        '-granat',
        'granat-',
        'granat--350',
        'granat 350',
        'granat_1',
        '',
      ]) {
        await http()
          .post('/api/v1/admin/products')
          .set('Authorization', `Bearer ${asAdmin()}`)
          .send({ slug, name: name('x') })
          .expect(400);
      }
    });

    it('requires all three locales for a name', async () => {
      await http()
        .post('/api/v1/admin/products')
        .set('Authorization', `Bearer ${asAdmin()}`)
        .send({ slug: `${PREFIX}-partial`, name: { uz: 'Anor', ru: 'Гранат' } })
        .expect(400);
    });

    it('rejects an unknown field rather than ignoring it', async () => {
      // `forbidNonWhitelisted` — a caller who misspells a field must be told,
      // not left believing the option took effect.
      await http()
        .post('/api/v1/admin/products')
        .set('Authorization', `Bearer ${asAdmin()}`)
        .send({ slug: `${PREFIX}-unknown`, name: name('x'), published: true })
        .expect(400);
    });

    it('refuses to rename a slug through the update endpoint', async () => {
      const { id } = await createProduct(`${PREFIX}-fixed-slug`);
      await http()
        .patch(`/api/v1/admin/products/${id}`)
        .set('Authorization', `Bearer ${asAdmin()}`)
        .send({ slug: `${PREFIX}-renamed` })
        .expect(400);

      const after = await prisma.product.findUniqueOrThrow({ where: { id } });
      expect(after.slug).toBe(`${PREFIX}-fixed-slug`);
    });

    it('bounds a variant volume', async () => {
      const { id } = await createProduct(`${PREFIX}-volumes`);
      for (const volumeMl of [0, -350, 25_000, 3.5, 'large']) {
        await http()
          .post(`/api/v1/admin/products/${id}/variants`)
          .set('Authorization', `Bearer ${asAdmin()}`)
          .send({ volumeMl })
          .expect(400);
      }
      await http()
        .post(`/api/v1/admin/products/${id}/variants`)
        .set('Authorization', `Bearer ${asAdmin()}`)
        .send({ volumeMl: 350 })
        .expect(201);
    });

    it('rejects a malformed id before it reaches the database', async () => {
      await http()
        .get('/api/v1/admin/products/not-a-uuid')
        .set('Authorization', `Bearer ${asAdmin()}`)
        .expect(400);
    });

    it('rejects a document of an unknown kind', async () => {
      const { id } = await createProduct(`${PREFIX}-doc-kind`);
      await http()
        .post(`/api/v1/admin/products/${id}/documents`)
        .set('Authorization', `Bearer ${asAdmin()}`)
        .send({
          mediaAssetId: '00000000-0000-4000-8000-000000000000',
          kind: 'INVOICE',
          title: name('x'),
        })
        .expect(400);
    });

    it('refuses a category that does not exist instead of creating an orphan', async () => {
      await http()
        .post('/api/v1/admin/products')
        .set('Authorization', `Bearer ${asAdmin()}`)
        .send({
          slug: `${PREFIX}-orphan`,
          name: name('x'),
          categoryId: '00000000-0000-4000-8000-000000000000',
        })
        .expect(400);
    });

    it('parses ?isActive=false as false', async () => {
      // `@Type(() => Boolean)` would make this `true` — `Boolean('false')` is
      // `true` — and the endpoint would silently return the opposite set.
      await createProduct(`${PREFIX}-filter-draft`);
      await createProduct(`${PREFIX}-filter-live`, { isActive: true });

      const drafts = await http()
        .get(`/api/v1/admin/products?isActive=false&q=${PREFIX}-filter`)
        .set('Authorization', `Bearer ${asAdmin()}`)
        .expect(200);
      const slugs = (drafts.body.items as { slug: string }[]).map((item) => item.slug);

      expect(slugs).toContain(`${PREFIX}-filter-draft`);
      expect(slugs).not.toContain(`${PREFIX}-filter-live`);
    });

    it('rejects a non-boolean filter rather than coercing it', async () => {
      await http()
        .get('/api/v1/admin/products?isActive=maybe')
        .set('Authorization', `Bearer ${asAdmin()}`)
        .expect(400);
    });
  });

  describe('slug uniqueness', () => {
    it('refuses a duplicate slug', async () => {
      await createProduct(`${PREFIX}-unique`);
      const conflict = await http()
        .post('/api/v1/admin/products')
        .set('Authorization', `Bearer ${asAdmin()}`)
        .send({ slug: `${PREFIX}-unique`, name: name('other') })
        .expect(409);
      expect(conflict.body.code).toBe('SLUG_TAKEN');
    });

    it('keeps a slug reserved after the product is deleted', async () => {
      // The slug is the public URL. Handing it to a different product would
      // resurrect a dead link pointing at unrelated content.
      const { id } = await createProduct(`${PREFIX}-retired`);
      await http()
        .delete(`/api/v1/admin/products/${id}`)
        .set('Authorization', `Bearer ${asAdmin()}`)
        .expect(204);

      const conflict = await http()
        .post('/api/v1/admin/products')
        .set('Authorization', `Bearer ${asAdmin()}`)
        .send({ slug: `${PREFIX}-retired`, name: name('replacement') })
        .expect(409);
      expect(conflict.body.code).toBe('SLUG_TAKEN');
    });

    it('refuses a duplicate category slug', async () => {
      const conflict = await http()
        .post('/api/v1/admin/product-categories')
        .set('Authorization', `Bearer ${asAdmin()}`)
        .send({ slug: `${PREFIX}-sharbatlar`, name: name('again') })
        .expect(409);
      expect(conflict.body.code).toBe('SLUG_TAKEN');
    });

    it('refuses a duplicate SKU across products', async () => {
      const first = await createProduct(`${PREFIX}-sku-a`);
      const second = await createProduct(`${PREFIX}-sku-b`);
      const sku = `${PREFIX}-SKU-350`;

      await http()
        .post(`/api/v1/admin/products/${first.id}/variants`)
        .set('Authorization', `Bearer ${asAdmin()}`)
        .send({ volumeMl: 350, sku })
        .expect(201);

      const conflict = await http()
        .post(`/api/v1/admin/products/${second.id}/variants`)
        .set('Authorization', `Bearer ${asAdmin()}`)
        .send({ volumeMl: 350, sku })
        .expect(409);
      expect(conflict.body.code).toBe('SKU_TAKEN');
    });
  });

  describe('the public API never shows a draft', () => {
    it('hides an unpublished product from the listing and from its own URL', async () => {
      const slug = `${PREFIX}-draft`;
      await createProduct(slug);

      const list = await http().get(`/api/v1/products?pageSize=100`).expect(200);
      expect((list.body.items as { slug: string }[]).map((i) => i.slug)).not.toContain(slug);

      await http().get(`/api/v1/products/${slug}`).expect(404);
    });

    it('answers identically for a draft and for a slug that never existed', async () => {
      const draft = await http().get(`/api/v1/products/${PREFIX}-draft`).expect(404);
      const missing = await http().get(`/api/v1/products/${PREFIX}-no-such-thing`).expect(404);

      // Distinguishing them would confirm which slugs are being prepared for
      // launch to anyone willing to guess.
      expect(draft.body.code).toBe(missing.body.code);
      expect(draft.body.message).toBe(missing.body.message);
    });

    it('has no query parameter that asks for one', async () => {
      for (const query of [
        'isActive=true',
        'isActive=false',
        'deletedAt=null',
        'includeDrafts=1',
      ]) {
        await http().get(`/api/v1/products?${query}`).expect(400);
      }
    });

    it('shows the product once it is published, and stamps publishedAt once', async () => {
      const slug = `${PREFIX}-publish-me`;
      const { id } = await createProduct(slug);
      await http().get(`/api/v1/products/${slug}`).expect(404);

      const published = await http()
        .patch(`/api/v1/admin/products/${id}`)
        .set('Authorization', `Bearer ${asAdmin()}`)
        .send({ isActive: true })
        .expect(200);
      expect(published.body.publishedAt).not.toBeNull();

      await http().get(`/api/v1/products/${slug}`).expect(200);

      const edited = await http()
        .patch(`/api/v1/admin/products/${id}`)
        .set('Authorization', `Bearer ${asAdmin()}`)
        .send({ displayOrder: 3 })
        .expect(200);
      // Re-saving a published product must not move its publication date.
      expect(edited.body.publishedAt).toBe(published.body.publishedAt);
    });

    it('hides it again when it is unpublished', async () => {
      const slug = `${PREFIX}-unpublish-me`;
      const { id } = await createProduct(slug, { isActive: true });
      await http().get(`/api/v1/products/${slug}`).expect(200);

      await http()
        .patch(`/api/v1/admin/products/${id}`)
        .set('Authorization', `Bearer ${asAdmin()}`)
        .send({ isActive: false })
        .expect(200);

      await http().get(`/api/v1/products/${slug}`).expect(404);
    });

    it('hides a soft-deleted product while keeping the row', async () => {
      const slug = `${PREFIX}-soft-deleted`;
      const { id } = await createProduct(slug, { isActive: true });
      await http()
        .post(`/api/v1/admin/products/${id}/variants`)
        .set('Authorization', `Bearer ${asAdmin()}`)
        .send({ volumeMl: 350 })
        .expect(201);
      await http().get(`/api/v1/products/${slug}`).expect(200);

      await http()
        .delete(`/api/v1/admin/products/${id}`)
        .set('Authorization', `Bearer ${asAdmin()}`)
        .expect(204);

      await http().get(`/api/v1/products/${slug}`).expect(404);
      const list = await http().get('/api/v1/products?pageSize=100').expect(200);
      expect((list.body.items as { slug: string }[]).map((i) => i.slug)).not.toContain(slug);

      // The row survives, because order history will point at its variants.
      const row = await prisma.product.findUniqueOrThrow({
        where: { id },
        include: { variants: true },
      });
      expect(row.deletedAt).not.toBeNull();
      expect(row.isActive).toBe(false);
      expect(row.variants).toHaveLength(1);
      expect(row.variants[0]?.deletedAt).not.toBeNull();
    });

    it('drops an inactive variant from the public payload but not from the admin one', async () => {
      const slug = `${PREFIX}-variants`;
      const { id } = await createProduct(slug, { isActive: true });

      for (const [volumeMl, isActive] of [
        [350, true],
        [1000, false],
      ] as const) {
        await http()
          .post(`/api/v1/admin/products/${id}/variants`)
          .set('Authorization', `Bearer ${asAdmin()}`)
          .send({ volumeMl, isActive })
          .expect(201);
      }

      const publicView = await http().get(`/api/v1/products/${slug}`).expect(200);
      expect((publicView.body.variants as { volumeMl: number }[]).map((v) => v.volumeMl)).toEqual([
        350,
      ]);

      const adminView = await http()
        .get(`/api/v1/admin/products/${id}`)
        .set('Authorization', `Bearer ${asAdmin()}`)
        .expect(200);
      expect((adminView.body.variants as { volumeMl: number }[]).map((v) => v.volumeMl)).toEqual([
        350, 1000,
      ]);
    });

    it('omits a category whose only products are drafts', async () => {
      const categorySlug = `${PREFIX}-empty-cat`;
      const created = await http()
        .post('/api/v1/admin/product-categories')
        .set('Authorization', `Bearer ${asAdmin()}`)
        .send({ slug: categorySlug, name: name('Drafts only') })
        .expect(201);

      const { id } = await createProduct(`${PREFIX}-cat-draft`, {
        categoryId: created.body.id as string,
      });

      const before = await http().get('/api/v1/products/categories').expect(200);
      expect((before.body as { slug: string }[]).map((c) => c.slug)).not.toContain(categorySlug);

      await http()
        .patch(`/api/v1/admin/products/${id}`)
        .set('Authorization', `Bearer ${asAdmin()}`)
        .send({ isActive: true })
        .expect(200);

      const after = await http().get('/api/v1/products/categories').expect(200);
      expect((after.body as { slug: string }[]).map((c) => c.slug)).toContain(categorySlug);
    });

    it('never returns an admin-only field on a public product', async () => {
      const slug = `${PREFIX}-shape`;
      await createProduct(slug, { isActive: true });
      const response = await http().get(`/api/v1/products/${slug}`).expect(200);

      for (const field of ['isActive', 'publishedAt', 'displayOrder', 'categoryId', 'deletedAt']) {
        expect(response.body).not.toHaveProperty(field);
      }
    });
  });

  describe('categories', () => {
    it('refuses to delete a category that still has products', async () => {
      const conflict = await http()
        .delete(`/api/v1/admin/product-categories/${categoryId}`)
        .set('Authorization', `Bearer ${asAdmin()}`)
        .expect(409);
      expect(conflict.body.code).toBe('CATEGORY_NOT_EMPTY');
    });

    it('refuses a cycle in the category tree', async () => {
      const parent = await http()
        .post('/api/v1/admin/product-categories')
        .set('Authorization', `Bearer ${asAdmin()}`)
        .send({ slug: `${PREFIX}-parent`, name: name('Parent') })
        .expect(201);
      const child = await http()
        .post('/api/v1/admin/product-categories')
        .set('Authorization', `Bearer ${asAdmin()}`)
        .send({
          slug: `${PREFIX}-child`,
          name: name('Child'),
          parentId: parent.body.id as string,
        })
        .expect(201);

      const conflict = await http()
        .patch(`/api/v1/admin/product-categories/${parent.body.id as string}`)
        .set('Authorization', `Bearer ${asAdmin()}`)
        .send({ parentId: child.body.id as string })
        .expect(400);
      expect(conflict.body.code).toBe('CATEGORY_CYCLE');
    });
  });

  describe('media attachments', () => {
    it('refuses a document asset in the image gallery and vice versa', async () => {
      const { id } = await createProduct(`${PREFIX}-media`);

      const pdf = await prisma.mediaAsset.create({
        data: {
          storageKey: `${PREFIX}/doc.pdf`,
          bucket: 'test',
          originalFilename: 'doc.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 10,
          checksum: 'x'.repeat(64),
          kind: 'DOCUMENT',
        },
      });

      const rejected = await http()
        .post(`/api/v1/admin/products/${id}/images`)
        .set('Authorization', `Bearer ${asAdmin()}`)
        .send({ mediaAssetId: pdf.id })
        .expect(400);
      expect(rejected.body.code).toBe('MEDIA_KIND_MISMATCH');

      await http()
        .post(`/api/v1/admin/products/${id}/documents`)
        .set('Authorization', `Bearer ${asAdmin()}`)
        .send({ mediaAssetId: pdf.id, kind: 'CERTIFICATE', title: name('Sertifikat') })
        .expect(201);
    });

    it('keeps exactly one primary image', async () => {
      const { id } = await createProduct(`${PREFIX}-gallery`);

      for (const index of [0, 1]) {
        const asset = await prisma.mediaAsset.create({
          data: {
            storageKey: `${PREFIX}/image-${index}.jpg`,
            bucket: 'test',
            originalFilename: `image-${index}.jpg`,
            mimeType: 'image/jpeg',
            sizeBytes: 10,
            checksum: String(index).repeat(64),
            kind: 'IMAGE',
          },
        });
        await http()
          .post(`/api/v1/admin/products/${id}/images`)
          .set('Authorization', `Bearer ${asAdmin()}`)
          .send({ mediaAssetId: asset.id, isPrimary: true })
          .expect(201);
      }

      const primaries = await prisma.productImage.count({
        where: { productId: id, isPrimary: true },
      });
      expect(primaries).toBe(1);
    });

    it('refuses a reorder that does not list exactly this product’s images', async () => {
      const { id } = await createProduct(`${PREFIX}-reorder`);
      const asset = await prisma.mediaAsset.create({
        data: {
          storageKey: `${PREFIX}/reorder.jpg`,
          bucket: 'test',
          originalFilename: 'reorder.jpg',
          mimeType: 'image/jpeg',
          sizeBytes: 10,
          checksum: 'a'.repeat(64),
          kind: 'IMAGE',
        },
      });
      await http()
        .post(`/api/v1/admin/products/${id}/images`)
        .set('Authorization', `Bearer ${asAdmin()}`)
        .send({ mediaAssetId: asset.id })
        .expect(201);

      const mismatch = await http()
        .put(`/api/v1/admin/products/${id}/images/order`)
        .set('Authorization', `Bearer ${asAdmin()}`)
        .send({ ids: ['00000000-0000-4000-8000-000000000000'] })
        .expect(400);
      expect(mismatch.body.code).toBe('REORDER_MISMATCH');
    });
  });

  describe('audit', () => {
    it('records who published a product', async () => {
      const { id } = await createProduct(`${PREFIX}-audited`);
      await http()
        .patch(`/api/v1/admin/products/${id}`)
        .set('Authorization', `Bearer ${asAdmin()}`)
        .send({ isActive: true })
        .expect(200);

      const rows = await prisma.auditLog.findMany({
        where: { entity: 'Product', entityId: id },
        orderBy: { createdAt: 'asc' },
      });
      expect(rows.map((row) => row.action)).toEqual(['product.created', 'product.published']);
      expect(rows.every((row) => row.actorEmail === ADMIN)).toBe(true);
    });
  });
});
