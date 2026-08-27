// @ts-check
import { createBaseConfig } from '@barff/config/eslint/base';
import { nestjsOverrides } from '@barff/config/eslint/nestjs';

/**
 * Root ESLint configuration for the BARFF monorepo.
 *
 * The rules themselves live in `@barff/config` so the apps and services added
 * in later steps share exactly one definition.
 *
 * Flat config does not merge nested config files the way `.eslintrc` did — one
 * `eslint .` from the root uses this file alone. Per-area overrides therefore
 * live here rather than in a config file per package.
 */
export default createBaseConfig([
  ...nestjsOverrides,
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
