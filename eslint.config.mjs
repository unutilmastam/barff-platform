// @ts-check
import { createBaseConfig } from '@barff/config/eslint/base';

/**
 * Root ESLint configuration for the BARFF monorepo.
 *
 * The rules themselves live in `@barff/config` so the apps and services added
 * in later steps share exactly one definition. Framework-specific presets
 * (Next.js, NestJS) are layered on by the app that needs them.
 */
export default createBaseConfig([
  {
    files: ['packages/*/src/**/*.ts'],
    rules: {
      // Shared packages are consumed by the browser apps as well as the API,
      // so they must not log or reach for process-level configuration.
      'no-console': 'error',
    },
  },
  {
    files: ['packages/*/src/**/*.test.ts'],
    rules: {
      'no-console': 'off',
    },
  },
]);
