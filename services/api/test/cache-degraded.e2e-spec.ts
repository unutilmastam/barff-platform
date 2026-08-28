import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Redis unreachable, Postgres real. `ConfigModule.forRoot()` is evaluated when
// `app.module.ts` is imported, so this has to run before the imports below —
// `beforeAll` would be too late. Port 1 is reserved and never listening, which
// keeps the suite self-contained instead of stopping the Redis the rest of the
// tests use.
vi.hoisted(() => {
  process.env['REDIS_URL'] = 'redis://127.0.0.1:1';
});
import { AppModule } from '../src/app.module.js';
import { AppConfigService } from '../src/common/config/app-config.service.js';
import { configureApp } from '../src/bootstrap.js';

/**
 * The public site when the cache is down.
 *
 * A cache is a speed layer in front of Postgres, not a dependency of
 * correctness. If an ElastiCache failover can take barff.uz off the air, the
 * cache has made the system *less* available than it was without one — so the
 * only acceptable behaviour is slower, not broken.
 *
 * Worth an explicit test because the failure is asymmetric: with Redis healthy
 * every one of these paths is exercised constantly and looks fine, and the
 * degraded path is the one nobody runs until the day it matters.
 */
describe('public API with Redis unreachable (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app, app.get(AppConfigService));
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('still serves every cacheable public route', async () => {
    for (const path of [
      '/api/v1/products',
      '/api/v1/products/categories',
      '/api/v1/news',
      '/api/v1/content/certificates',
      '/api/v1/content/gallery',
      '/api/v1/content/documents',
      '/api/v1/content/production-steps',
      '/api/v1/content/sections/home',
      '/api/v1/content/settings',
    ]) {
      await request(app.getHttpServer()).get(path).expect(200);
    }
  });

  it('reports every request as a miss rather than pretending to cache', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/news').expect(200);
    expect(response.headers['x-cache']).toBe('MISS');

    const second = await request(app.getHttpServer()).get('/api/v1/news').expect(200);
    expect(second.headers['x-cache']).toBe('MISS');
  });

  it('still sends a usable ETag, so revalidation keeps working', async () => {
    // Without Redis the body is re-rendered each time, but it is byte-identical
    // for identical data — so a returning client can still be answered 304 and
    // the bandwidth saving survives the outage.
    const first = await request(app.getHttpServer()).get('/api/v1/content/production-steps');
    expect(first.headers.etag).toMatch(/^"[0-9a-f]{64}"$/);

    await request(app.getHttpServer())
      .get('/api/v1/content/production-steps')
      .set('If-None-Match', first.headers.etag as string)
      .expect(304);
  });

  it('keeps private routes uncacheable', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/admin/news').expect(401);
    expect(response.headers['cache-control']).toBe('no-store');
  });
});
