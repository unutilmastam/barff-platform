import { z } from 'zod';

/**
 * Environment contract for the API.
 *
 * Validation runs once at boot and the process exits if anything is missing or
 * malformed — a service that starts with a broken configuration and fails on
 * the first request is harder to diagnose than one that refuses to start
 * (`ROADMAP.md` S02: "fail fast on missing vars").
 *
 * Every name here also appears in the repository's `.env.example`. Values never
 * do: production secrets come from AWS Secrets Manager (`CLAUDE.md` §12).
 */

const nodeEnvSchema = z.enum(['development', 'test', 'staging', 'production']);

const portSchema = z.coerce.number().int().min(1).max(65_535);

/**
 * Comma-separated origin list, e.g. `https://barff.uz,https://admin.barff.uz`.
 *
 * There is no wildcard escape hatch: CORS is strict (§12), so an origin that is
 * not listed is not allowed. An empty list means "same-origin only".
 */
const originListSchema = z
  .string()
  .default('')
  .transform((value) =>
    value
      .split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
  )
  .pipe(
    z.array(
      z
        .string()
        .url({ error: 'CORS_ALLOWED_ORIGINS must contain absolute URLs' })
        .refine((origin) => !origin.endsWith('/'), {
          error: 'CORS origins must not have a trailing slash',
        }),
    ),
  );

export const envSchema = z
  .object({
    NODE_ENV: nodeEnvSchema.default('development'),
    LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

    API_PORT: portSchema.default(4000),
    API_HOST: z.string().min(1).default('0.0.0.0'),
    API_GLOBAL_PREFIX: z.string().min(1).default('api'),
    API_PUBLIC_URL: z.string().url().optional(),

    CORS_ALLOWED_ORIGINS: originListSchema,

    /** Throttler window in seconds and the request budget inside it. */
    RATE_LIMIT_TTL: z.coerce.number().int().positive().default(60),
    RATE_LIMIT_LIMIT: z.coerce.number().int().positive().default(120),

    // Required with no default: a wrong-but-present connection string fails
    // loudly at the readiness probe, while a missing one is a deploy mistake
    // that should never reach a running container.
    DATABASE_URL: z.string().url({ error: 'DATABASE_URL must be a postgres:// URL' }),
    REDIS_URL: z.string().url({ error: 'REDIS_URL must be a redis:// URL' }),

    // --- Auth (§12) ---------------------------------------------------------
    // Secrets are required with no default. A development fallback is how a
    // placeholder secret reaches production and every token becomes forgeable;
    // refusing to start is the cheaper failure. 32 characters is the floor for
    // an HS256 key.
    JWT_ACCESS_SECRET: z
      .string()
      .min(32, { error: 'JWT_ACCESS_SECRET must be at least 32 characters' }),
    JWT_REFRESH_SECRET: z
      .string()
      .min(32, { error: 'JWT_REFRESH_SECRET must be at least 32 characters' }),
    /** Access token lifetime in seconds. Short: it cannot be revoked early. */
    JWT_ACCESS_TTL: z.coerce.number().int().positive().default(900),
    /** Refresh token lifetime in seconds. Revocable, so it may be long. */
    JWT_REFRESH_TTL: z.coerce
      .number()
      .int()
      .positive()
      .default(60 * 60 * 24 * 30),

    COOKIE_DOMAIN: z.string().optional(),
    COOKIE_SECURE: z
      .enum(['true', 'false'])
      .default('true')
      .transform((value) => value === 'true'),

    /** Per-account lockout, on top of the per-IP throttler. */
    LOGIN_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
    LOGIN_LOCKOUT_SECONDS: z.coerce.number().int().positive().default(900),

    // --- Media and object storage (§20) ------------------------------------
    /**
     * `s3` in every deployed environment; `filesystem` only for local work
     * without MinIO. The refinement below refuses `filesystem` in production.
     */
    STORAGE_PROVIDER: z.enum(['s3', 'filesystem']).default('s3'),
    S3_ENDPOINT: z.string().url().optional(),
    S3_REGION: z.string().min(1).default('us-east-1'),
    S3_BUCKET: z.string().min(1).default('barff-media'),
    S3_ACCESS_KEY_ID: z.string().min(1).default('barff_minio'),
    S3_SECRET_ACCESS_KEY: z.string().min(1).default('barff_minio_dev_password'),
    /** MinIO and most S3-compatible servers require path-style addressing. */
    S3_FORCE_PATH_STYLE: z
      .enum(['true', 'false'])
      .default('true')
      .transform((value) => value === 'true'),
    /**
     * How long a signed URL stays valid. Short on purpose: it is a bearer
     * credential that gets pasted into chat and forwarded in email.
     */
    S3_SIGNED_URL_TTL: z.coerce.number().int().positive().max(86_400).default(900),
    /** CDN origin for objects deliberately marked public. */
    MEDIA_CDN_URL: z.string().url().optional(),
    /** Root for the filesystem provider. Ignored when STORAGE_PROVIDER is s3. */
    MEDIA_FILESYSTEM_ROOT: z.string().min(1).default('.media-storage'),
    /**
     * Upload ceiling. Enforced by multer before the body is buffered, so an
     * oversized upload is refused rather than read into memory first.
     */
    MEDIA_MAX_UPLOAD_BYTES: z.coerce
      .number()
      .int()
      .positive()
      .default(25 * 1024 * 1024),
  })
  .superRefine((env, ctx) => {
    // Signing both token types with the same key means a refresh token is a
    // valid access token: anyone holding one could call any endpoint with it,
    // and the short access TTL would buy nothing.
    if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
      ctx.addIssue({
        code: 'custom',
        path: ['JWT_REFRESH_SECRET'],
        message: 'JWT_REFRESH_SECRET must differ from JWT_ACCESS_SECRET',
      });
    }
    if (env.NODE_ENV === 'production' && env.STORAGE_PROVIDER !== 's3') {
      // The filesystem provider stores uploads on the container's own disk,
      // which ECS discards on every deploy. Shipping it would silently lose
      // every file the client uploaded.
      ctx.addIssue({
        code: 'custom',
        path: ['STORAGE_PROVIDER'],
        message: 'STORAGE_PROVIDER must be "s3" in production',
      });
    }
    if (env.NODE_ENV === 'production' && !env.COOKIE_SECURE) {
      ctx.addIssue({
        code: 'custom',
        path: ['COOKIE_SECURE'],
        message: 'COOKIE_SECURE must be true in production',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

/**
 * `@nestjs/config`'s `validate` hook.
 *
 * Throws with every problem listed at once rather than one per restart.
 */
export function validateEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);

  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }

  return result.data;
}
