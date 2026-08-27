// @ts-check

/**
 * ESLint overrides for NestJS services.
 *
 * Applied on top of the base config for `services/*`.
 */
/** @type {import('typescript-eslint').ConfigArray} */
export const nestjsOverrides = [
  {
    files: ['services/*/src/**/*.ts', 'services/*/test/**/*.ts'],
    rules: {
      /**
       * OFF, and it must stay off.
       *
       * Nest resolves constructor dependencies from `design:paramtypes`, which
       * TypeScript only emits for imports that survive as *values*. Rewriting
       *
       *   import { ConfigService } from '@nestjs/config';
       *
       * to `import type` erases the import, the metadata becomes `Object`, and
       * the app dies at boot with "Nest can't resolve dependencies of the
       * AppConfigService (?)". The rule flags exactly the injected classes,
       * and `--fix` would apply the breakage silently.
       *
       * Type-only imports are still written as `import { type Foo }` inline by
       * convention; this only stops the rule from rewriting the ones DI needs.
       */
      '@typescript-eslint/consistent-type-imports': 'off',

      // Services are the layer that legitimately logs and reads configuration,
      // unlike packages/* — but logging still goes through the LoggerService.
      'no-console': 'error',
    },
  },
  {
    files: ['services/*/**/*.test.ts', 'services/*/test/**/*.e2e-spec.ts'],
    rules: {
      'no-console': 'off',
    },
  },
];

export default nestjsOverrides;
