import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Env } from './env.schema.js';

/**
 * Typed accessor over `ConfigService`.
 *
 * Callers get `number` and `string[]` rather than `string | undefined`, so no
 * module needs to re-parse or re-default an environment variable. The schema is
 * the only place a default is written down.
 */
@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  private get<K extends keyof Env>(key: K): Env[K] {
    return this.config.get(key, { infer: true });
  }

  get nodeEnv(): Env['NODE_ENV'] {
    return this.get('NODE_ENV');
  }

  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  }

  get isTest(): boolean {
    return this.nodeEnv === 'test';
  }

  get logLevel(): Env['LOG_LEVEL'] {
    return this.get('LOG_LEVEL');
  }

  get port(): number {
    return this.get('API_PORT');
  }

  get host(): string {
    return this.get('API_HOST');
  }

  get globalPrefix(): string {
    return this.get('API_GLOBAL_PREFIX');
  }

  get publicUrl(): string | undefined {
    return this.get('API_PUBLIC_URL');
  }

  get corsAllowedOrigins(): string[] {
    return this.get('CORS_ALLOWED_ORIGINS');
  }

  get rateLimit(): { ttlSeconds: number; limit: number } {
    return { ttlSeconds: this.get('RATE_LIMIT_TTL'), limit: this.get('RATE_LIMIT_LIMIT') };
  }

  get databaseUrl(): string {
    return this.get('DATABASE_URL');
  }

  get redisUrl(): string {
    return this.get('REDIS_URL');
  }

  get jwt(): {
    accessSecret: string;
    refreshSecret: string;
    accessTtlSeconds: number;
    refreshTtlSeconds: number;
  } {
    return {
      accessSecret: this.get('JWT_ACCESS_SECRET'),
      refreshSecret: this.get('JWT_REFRESH_SECRET'),
      accessTtlSeconds: this.get('JWT_ACCESS_TTL'),
      refreshTtlSeconds: this.get('JWT_REFRESH_TTL'),
    };
  }

  get cookie(): { domain: string | undefined; secure: boolean } {
    return { domain: this.get('COOKIE_DOMAIN'), secure: this.get('COOKIE_SECURE') };
  }

  get loginThrottle(): { maxAttempts: number; lockoutSeconds: number } {
    return {
      maxAttempts: this.get('LOGIN_MAX_ATTEMPTS'),
      lockoutSeconds: this.get('LOGIN_LOCKOUT_SECONDS'),
    };
  }
}
