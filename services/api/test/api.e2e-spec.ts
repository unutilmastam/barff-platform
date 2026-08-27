import { Body, Controller, Get, type INestApplication, Post, Query } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ApiTags } from '@nestjs/swagger';
import request from 'supertest';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { leadCreateSchema } from '@barff/validation';
import { AppModule } from '../src/app.module.js';
import { AppConfigService } from '../src/common/config/app-config.service.js';
import { buildSwaggerDocument, configureApp, docsPath, setupSwagger } from '../src/bootstrap.js';
import { SortableQueryDto } from '../src/common/dto/sort-query.dto.js';
import { zodBody } from '../src/common/pipes/zod-validation.pipe.js';

/**
 * Probe controller.
 *
 * The skeleton has no business endpoints yet, so the global pipes and filter
 * would otherwise only ever be exercised against 404s. This module is mounted
 * by the test alone — it never ships — and gives the DTO helpers and the Zod
 * pipe a real route to run through.
 */
class ProbeQueryDto extends SortableQueryDto(['name', 'createdAt'] as const, 'createdAt') {}

@ApiTags('probe')
@Controller({ path: 'probe', version: '1' })
class ProbeController {
  @Get()
  list(@Query() query: ProbeQueryDto) {
    return {
      page: query.page,
      pageSize: query.pageSize,
      skip: query.skip,
      sortBy: query.sortBy,
      sortDir: query.sortDir,
      orderBy: query.orderBy,
    };
  }

  @Post('lead')
  createLead(@Body(zodBody(leadCreateSchema)) body: unknown) {
    return body;
  }
}

describe('API skeleton (e2e)', () => {
  let app: INestApplication;
  let config: AppConfigService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ProbeController],
    }).compile();

    app = moduleRef.createNestApplication();
    config = app.get(AppConfigService);
    configureApp(app, config);
    setupSwagger(app, config);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('routing and versioning', () => {
    it('serves the documented /api/v1 prefix', async () => {
      await request(app.getHttpServer()).get('/api/v1/health/live').expect(200);
    });

    it('does not serve an unversioned path', async () => {
      await request(app.getHttpServer()).get('/api/health/live').expect(404);
    });
  });

  describe('health', () => {
    it('reports liveness without touching any dependency', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/health/live').expect(200);
      expect(response.body.status).toBe('ok');
    });

    it('reports readiness for postgres and redis', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/health');

      // Both dependencies must be named whether they are up or down, so an
      // operator can see which one failed.
      const reported = { ...response.body.info, ...response.body.error };
      expect(Object.keys(reported).sort()).toEqual(['database', 'redis']);

      if (response.status === 200) {
        expect(response.body.status).toBe('ok');
        expect(response.body.info.database.status).toBe('up');
        expect(response.body.info.redis.status).toBe('up');
      } else {
        expect(response.status).toBe(503);
        expect(response.body.status).toBe('error');
      }
    });

    it('is not rate limited', async () => {
      // Probes poll on a fixed interval; throttling them turns a busy minute
      // into a false outage.
      for (let i = 0; i < 30; i += 1) {
        await request(app.getHttpServer()).get('/api/v1/health/live').expect(200);
      }
    });
  });

  describe('request id', () => {
    it('generates one and echoes it on the response', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/health/live').expect(200);
      expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('reuses a well-formed inbound id so a trace survives the edge', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health/live')
        .set('x-request-id', 'trace-abc123456')
        .expect(200);
      expect(response.headers['x-request-id']).toBe('trace-abc123456');
    });

    it('replaces a malformed inbound id rather than logging it', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health/live')
        .set('x-request-id', 'bad id with spaces <script>')
        .expect(200);
      expect(response.headers['x-request-id']).not.toContain('script');
      expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    });
  });

  describe('error shape', () => {
    it('returns the documented shape for an unknown route', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/nope').expect(404);
      expect(response.body).toMatchObject({ statusCode: 404, code: 'NOT_FOUND' });
      expect(typeof response.body.message).toBe('string');
      expect(response.body.requestId).toBe(response.headers['x-request-id']);
    });

    it('never leaks internals on a 500', async () => {
      // The filter maps any non-HttpException to a generic message; there is no
      // route that throws one yet, so assert the mapping directly.
      const { AllExceptionsFilter } = await import('../src/common/http/all-exceptions.filter.js');
      const filter = new AllExceptionsFilter();
      let body: unknown;
      const host = {
        switchToHttp: () => ({
          getResponse: () => ({
            headersSent: false,
            status: () => ({
              json: (payload: unknown) => {
                body = payload;
              },
            }),
          }),
          getRequest: () => ({ method: 'GET', originalUrl: '/api/v1/boom' }),
        }),
      } as never;

      filter.catch(new Error('connection string postgres://user:pw@host/db'), host);
      expect(body).toMatchObject({ statusCode: 500, code: 'INTERNAL_SERVER_ERROR' });
      expect(JSON.stringify(body)).not.toContain('postgres://');
    });
  });

  describe('global ValidationPipe', () => {
    it('applies the shared defaults', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/probe').expect(200);
      expect(response.body).toMatchObject({ page: 1, pageSize: 20, skip: 0 });
    });

    it('transforms query strings into numbers', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/probe?page=3&pageSize=25')
        .expect(200);
      expect(response.body).toMatchObject({ page: 3, pageSize: 25, skip: 50 });
    });

    it('enforces the shared page-size cap', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/probe?pageSize=1000')
        .expect(400);
      expect(response.body.code).toBe('VALIDATION_FAILED');
      expect(response.body.details).toBeDefined();
    });

    it('rejects unknown query parameters instead of ignoring them', async () => {
      // A silently dropped `?pagesize=50` typo would look like it worked.
      const response = await request(app.getHttpServer())
        .get('/api/v1/probe?pagesize=50')
        .expect(400);
      expect(response.body.code).toBe('VALIDATION_FAILED');
    });

    it('only allows sorting by an allow-listed column', async () => {
      await request(app.getHttpServer()).get('/api/v1/probe?sortBy=name').expect(200);
      await request(app.getHttpServer()).get('/api/v1/probe?sortBy=passwordHash').expect(400);
    });

    it('builds an orderBy from the validated column', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/probe?sortBy=name&sortDir=desc')
        .expect(200);
      expect(response.body.orderBy).toEqual({ name: 'desc' });
    });
  });

  describe('Zod pipe bridging @barff/validation', () => {
    const validLead = {
      companyName: 'MOCK Distribution LLC',
      contactName: 'MOCK Contact',
      phone: '901234567',
      region: 'Toshkent',
      businessType: 'Distributor',
    };

    it('accepts a payload the shared schema accepts, normalized', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/probe/lead')
        .send(validLead)
        .expect(201);
      expect(response.body.phone).toBe('+998901234567');
    });

    it('rejects with field-level details in the standard error shape', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/probe/lead')
        .send({ ...validLead, phone: 'not-a-phone' })
        .expect(400);

      expect(response.body).toMatchObject({ statusCode: 400, code: 'VALIDATION_FAILED' });
      expect(response.body.details.phone).toBeDefined();
      expect(response.body.requestId).toBe(response.headers['x-request-id']);
    });
  });

  describe('security headers and CORS', () => {
    it('sets helmet headers', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/health/live').expect(200);
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['content-security-policy']).toBeDefined();
      expect(response.headers['x-powered-by']).toBeUndefined();
    });

    it('refuses an origin that is not allow-listed', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/health/live')
        .set('Origin', 'https://evil.example');
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('Swagger', () => {
    it('serves the UI at the documented path', async () => {
      const response = await request(app.getHttpServer()).get(`/${docsPath(config)}`);
      expect([200, 301]).toContain(response.status);
    });

    it('serves the OpenAPI JSON', async () => {
      const response = await request(app.getHttpServer())
        .get(`/${docsPath(config)}-json`)
        .expect(200);
      expect(response.body.openapi).toMatch(/^3\./);
      expect(response.body.info.title).toBe('BARFF Platform API');
    });

    it('documents the health routes under the /api/v1 prefix', () => {
      const document = buildSwaggerDocument(app, config);
      expect(Object.keys(document.paths ?? {})).toContain('/api/v1/health');
    });
  });
});
