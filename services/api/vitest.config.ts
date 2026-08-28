import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

/**
 * NestJS DI resolves constructor dependencies from `emitDecoratorMetadata`,
 * which esbuild — vitest's default transformer — does not emit. SWC does, so it
 * replaces esbuild here. This is the documented way to run Nest under vitest,
 * and it lets the workspace keep one test runner instead of adding Jest
 * alongside it.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'test/**/*.e2e-spec.ts'],
    environment: 'node',
    globals: false,
    // Nest bootstraps a full application per e2e file; the default 5s is tight
    // when a health probe has to time out against a downed dependency.
    testTimeout: 30_000,
    hookTimeout: 30_000,

    /**
     * One test file at a time.
     *
     * These suites are integration tests against **one** Postgres and **one**
     * Redis. Row collisions were already avoided by giving each suite its own
     * key prefix, but the cache generation counters of S11 cannot be isolated
     * that way: namespace-wide invalidation is the entire point of them, so a
     * write in any suite retires a namespace for every suite.
     *
     * Concretely, `media.e2e-spec.ts` purges *all* namespaces on every upload
     * and delete, and `content.e2e-spec.ts` purges `certificates` whenever it
     * publishes one — while `public-cache.e2e-spec.ts` is asserting that an
     * untouched namespace stays cached. Run in parallel those are the same
     * milliseconds, and the cache suite fails with `expected 'MISS' to be
     * 'HIT'`. It passed locally for three consecutive full runs and failed in
     * CI, which is exactly the shape of a race: parallelism across these files
     * was never safe, it merely usually worked.
     *
     * The cost is about twenty seconds of wall time. The alternative — a Redis
     * database per worker — buys that back but only papers over the shared
     * state, and the next suite to depend on global state would fail the same
     * way with no warning.
     */
    fileParallelism: false,
  },
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
