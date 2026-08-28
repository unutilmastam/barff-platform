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

  get storage(): {
    provider: 's3' | 'filesystem';
    endpoint: string | undefined;
    region: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
    forcePathStyle: boolean;
    signedUrlTtlSeconds: number;
    cdnUrl: string | undefined;
    filesystemRoot: string;
    publicBaseUrl: string;
    maxUploadBytes: number;
  } {
    const cdnUrl = this.get('MEDIA_CDN_URL');
    const endpoint = this.get('S3_ENDPOINT');
    const bucket = this.get('S3_BUCKET');
    return {
      provider: this.get('STORAGE_PROVIDER'),
      endpoint,
      region: this.get('S3_REGION'),
      bucket,
      accessKeyId: this.get('S3_ACCESS_KEY_ID'),
      secretAccessKey: this.get('S3_SECRET_ACCESS_KEY'),
      forcePathStyle: this.get('S3_FORCE_PATH_STYLE'),
      signedUrlTtlSeconds: this.get('S3_SIGNED_URL_TTL'),
      cdnUrl,
      filesystemRoot: this.get('MEDIA_FILESYSTEM_ROOT'),
      // Always absolute. Falling back to a relative `/media` produced a base
      // that `new URL()` cannot parse, and every successful upload 500'd while
      // every rejection path kept working — so the failure looked like an
      // image-processing bug rather than a configuration one.
      publicBaseUrl: cdnUrl ?? `${this.publicUrl ?? `http://localhost:${this.port}`}/media`,
      maxUploadBytes: this.get('MEDIA_MAX_UPLOAD_BYTES'),
    };
  }

  get loginThrottle(): { maxAttempts: number; lockoutSeconds: number } {
    return {
      maxAttempts: this.get('LOGIN_MAX_ATTEMPTS'),
      lockoutSeconds: this.get('LOGIN_LOCKOUT_SECONDS'),
    };
  }
}
