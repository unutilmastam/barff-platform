import { type INestApplication, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppConfigService } from './common/config/app-config.service.js';

/**
 * Applies every global concern to an application instance.
 *
 * Extracted from `main.ts` so the e2e tests run against exactly the same
 * configuration production does — routing prefix, versioning, CORS and headers
 * included. A test that skips `enableVersioning` is a test that never proves
 * the real URLs work.
 */
export function configureApp(app: INestApplication, config: AppConfigService): void {
  app.setGlobalPrefix(config.globalPrefix);
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.use(
    helmet({
      // Swagger UI ships inline styles and scripts. The relaxation is scoped to
      // what it needs; this is a JSON API, so no other page is served from here.
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      // Cloudflare terminates TLS in front of this; HSTS is set at the edge.
      hsts: config.isProduction,
    }),
  );

  const allowedOrigins = config.corsAllowedOrigins;
  app.enableCors({
    // Strict by design (§12): no wildcard, and an unlisted origin is refused
    // rather than reflected. An empty list means same-origin only.
    origin: (
      origin: string | undefined,
      callback: (error: Error | null, allow?: boolean) => void,
    ) => {
      if (origin === undefined || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'Accept-Language'],
    exposedHeaders: ['X-Request-Id'],
    maxAge: 86_400,
  });

  app.enableShutdownHooks();
}

/** Path Swagger is served from, e.g. `api/v1/docs`. */
export function docsPath(config: AppConfigService): string {
  return `${config.globalPrefix}/v1/docs`;
}

export function buildSwaggerDocument(app: INestApplication, config: AppConfigService) {
  const builder = new DocumentBuilder()
    .setTitle('BARFF Platform API')
    .setDescription(
      [
        'API behind barff.uz, partner.barff.uz, admin.barff.uz and delivery.barff.uz.',
        '',
        'Every failure returns the same shape: `{ statusCode, message, code, requestId }`.',
        'Clients branch on `code`, never on `message` — messages are translated human text.',
        'Quote `requestId` when reporting a problem; it ties the response to the server logs.',
      ].join('\n'),
    )
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
    .addTag('health', 'Liveness and readiness probes');

  const publicUrl = config.publicUrl;
  if (publicUrl !== undefined) builder.addServer(publicUrl);

  return SwaggerModule.createDocument(app, builder.build());
}

/**
 * Mounts Swagger UI.
 *
 * Docs are not published in production: the endpoint list is a map of the
 * attack surface, and BARFF's API has no third-party consumers who need it.
 * Staging keeps it, which is where integration work happens.
 */
export function setupSwagger(app: INestApplication, config: AppConfigService): boolean {
  if (config.isProduction) return false;

  const document = buildSwaggerDocument(app, config);
  SwaggerModule.setup(docsPath(config), app, document, {
    jsonDocumentUrl: `${docsPath(config)}-json`,
    swaggerOptions: { persistAuthorization: true, tagsSorter: 'alpha', operationsSorter: 'alpha' },
  });
  return true;
}
