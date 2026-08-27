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

export const envSchema = z.object({
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
