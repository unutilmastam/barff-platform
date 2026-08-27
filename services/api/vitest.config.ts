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
  },
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
