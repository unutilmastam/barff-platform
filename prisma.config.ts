import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/**
 * Prisma CLI configuration.
 *
 * Replaces the `prisma` key in `package.json`, which Prisma 6 deprecates and
 * Prisma 7 removes.
 *
 * `dotenv/config` is imported explicitly: a config file does not get the
 * automatic `.env` loading the package.json key used to, so without it
 * `DATABASE_URL` would be undefined and every CLI command would fail with a
 * misleading connection error.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    // Run after `migrate dev`, `migrate reset` and `db seed`. Idempotent, so
    // re-running it is always safe.
    seed: 'tsx prisma/seed.ts',
  },
});
