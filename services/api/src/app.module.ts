import { type MiddlewareConsumer, Module, type NestModule, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule, seconds } from '@nestjs/throttler';
import { AppConfigModule } from './common/config/config.module.js';
import { AppConfigService } from './common/config/app-config.service.js';
import { PrismaModule } from './common/prisma/prisma.module.js';
import { RedisModule } from './common/redis/redis.module.js';
import { CacheModule } from './common/cache/cache.module.js';
import { HttpCacheInterceptor } from './common/cache/http-cache.interceptor.js';
import { NoStoreMiddleware } from './common/cache/no-store.middleware.js';
import { AuditModule } from './common/audit/audit.module.js';
import { AuthModule } from './auth/auth.module.js';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard.js';
import { RolesGuard } from './auth/guards/roles.guard.js';
import { PermissionsGuard } from './auth/guards/permissions.guard.js';
import { AllExceptionsFilter } from './common/http/all-exceptions.filter.js';
import { RequestIdMiddleware } from './common/http/request-id.middleware.js';
import { HealthModule } from './health/health.module.js';
import { MediaModule } from './media/media.module.js';
import { ProductsModule } from './products/products.module.js';
import { ContentModule } from './content/content.module.js';

/**
 * Root module.
 *
 * The cross-cutting concerns are registered here rather than in `main.ts` so
 * they also apply inside `Test.createTestingModule` — an exception filter that
 * only exists in `main.ts` is a filter the e2e tests never exercise.
 */
@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    RedisModule,
    CacheModule,
    AuditModule,
    AuthModule,
    MediaModule,
    ProductsModule,
    ContentModule,
    ThrottlerModule.forRootAsync({
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        throttlers: [{ ttl: seconds(config.rateLimit.ttlSeconds), limit: config.rateLimit.limit }],
      }),
    }),
    HealthModule,
  ],
  providers: [
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        // Strip properties without a decorator, and reject the request if the
        // client sent any: silently ignoring unknown fields hides typos and
        // lets a caller believe an option took effect when it did not.
        whitelist: true,
        forbidNonWhitelisted: true,
        // Query and path params arrive as strings; @Type() converts them.
        transform: true,
        transformOptions: { enableImplicitConversion: false },
      }),
    },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },

    // Serves cacheable public GETs from Redis and answers 304s. The `no-store`
    // default it overrides is set in middleware, not here — see
    // NoStoreMiddleware for why that distinction matters.
    { provide: APP_INTERCEPTOR, useClass: HttpCacheInterceptor },

    // Guard order matters and follows the order they are listed here:
    // throttle before authenticating (so an unauthenticated flood is cheap),
    // authenticate before authorizing (roles and permissions need a user), and
    // roles before permissions (the coarser check first).
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // First in the chain: everything downstream, including the exception
    // filter, relies on the request id already being in context.
    consumer.apply(RequestIdMiddleware, NoStoreMiddleware).forRoutes('*path');
  }
}
