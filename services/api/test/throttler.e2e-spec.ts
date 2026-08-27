import { Controller, Get, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Hoisted above the imports: `ConfigModule.forRoot()` is evaluated when
// `app.module.ts` is imported, so an override inside `beforeAll` would arrive
// after the limit had already been read.
vi.hoisted(() => {
  process.env['RATE_LIMIT_LIMIT'] = '3';
  process.env['RATE_LIMIT_TTL'] = '60';
});
import { AppModule } from '../src/app.module.js';
import { AppConfigService } from '../src/common/config/app-config.service.js';
import { configureApp } from '../src/bootstrap.js';

/**
 * Rate limiting.
 *
 * Split into its own file because the limit is read from the environment when
 * the module graph is imported, so it has to be lowered before that happens.
 *
 * Worth stating explicitly: the throttler is a **guard**, so it only runs on
 * routes that matched a controller. Hammering an unknown path returns 404s
 * forever and never trips the limit — that is Nest's design, not a gap, but it
 * makes "I tested it against /nope" a misleading way to verify throttling.
 */
@Controller({ path: 'limited', version: '1' })
class LimitedController {
  @Get()
  ping() {
    return { ok: true };
  }
}

describe('rate limiting (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [LimitedController],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app, app.get(AppConfigService));
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('allows requests up to the configured limit', async () => {
    for (let i = 0; i < 3; i += 1) {
      await request(app.getHttpServer()).get('/api/v1/limited').expect(200);
    }
  });

  it('rejects the next request in the standard error shape', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/limited').expect(429);

    expect(response.body).toMatchObject({ statusCode: 429, code: 'TOO_MANY_REQUESTS' });
    expect(response.body.requestId).toBe(response.headers['x-request-id']);
  });

  it('still answers liveness probes, which are exempt', async () => {
    // ECS polls on a fixed interval; throttling probes turns a busy minute
    // into a false outage.
    for (let i = 0; i < 5; i += 1) {
      await request(app.getHttpServer()).get('/api/v1/health/live').expect(200);
    }
  });
});
