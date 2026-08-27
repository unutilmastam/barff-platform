import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// `ConfigModule.forRoot()` is a decorator argument, so it is evaluated when
// `app.module.ts` is *imported* — before any `beforeAll` runs. Setting the
// environment in a hook would be too late and the app would quietly use the
// real connection strings. `vi.hoisted` runs ahead of the imports below.
// Port 1 is reserved and never listening, so this stays self-contained instead
// of stopping the services the rest of the suite uses.
vi.hoisted(() => {
  process.env['DATABASE_URL'] = 'postgresql://barff@127.0.0.1:1/barff';
  process.env['REDIS_URL'] = 'redis://127.0.0.1:1';
});
import { AppModule } from '../src/app.module.js';
import { AppConfigService } from '../src/common/config/app-config.service.js';
import { configureApp } from '../src/bootstrap.js';

/**
 * Readiness when a dependency is unreachable.
 *
 * The assertion that matters is not "it returns 503" — it is that the response
 * still names *which* dependency failed. A global exception filter will happily
 * flatten terminus's payload into a generic error body, and then a 503 tells an
 * operator nothing they did not already know.
 */
describe('health when dependencies are down (e2e)', () => {
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

  it('returns 503 and names the failing dependencies', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health/ready').expect(503);

    expect(response.body.status).toBe('error');
    expect(Object.keys(response.body.error).sort()).toEqual(['database', 'redis']);
    expect(response.body.error.database.status).toBe('down');
    expect(response.body.error.redis.status).toBe('down');
    // The generic error shape must not have replaced the terminus payload.
    expect(response.body.code).toBeUndefined();
  });

  it('keeps liveness green — restarting the API would not fix a database outage', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health/live').expect(200);
    expect(response.body.status).toBe('ok');
  });
});
