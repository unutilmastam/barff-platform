import { type MiddlewareConsumer, Module, type NestModule, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule, seconds } from '@nestjs/throttler';
import { AppConfigModule } from './common/config/config.module.js';
import { AppConfigService } from './common/config/app-config.service.js';
import { PrismaModule } from './common/prisma/prisma.module.js';
import { AllExceptionsFilter } from './common/http/all-exceptions.filter.js';
import { RequestIdMiddleware } from './common/http/request-id.middleware.js';
import { HealthModule } from './health/health.module.js';

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
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // First in the chain: everything downstream, including the exception
    // filter, relies on the request id already being in context.
    consumer.apply(RequestIdMiddleware).forRoutes('*path');
  }
}
