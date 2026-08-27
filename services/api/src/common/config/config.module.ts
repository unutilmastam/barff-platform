import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { AppConfigService } from './app-config.service.js';
import { validateEnv } from './env.schema.js';

/**
 * Global configuration module.
 *
 * `AppConfigService` is the only supported way to read configuration; modules
 * must not touch `process.env` directly, so there is one place where a variable
 * is named, defaulted and typed.
 */
@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
      // `.env` is for local development only. Staging and production inject
      // real environment variables from Secrets Manager (CLAUDE.md §12, §14).
      envFilePath: ['.env.local', '.env'],
    }),
  ],
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule {}
