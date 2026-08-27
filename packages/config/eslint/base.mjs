// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

/**
 * Paths that are never linted anywhere in the monorepo.
 *
 * `assets/` holds source media (see ASSETS.md) and contains no code.
 */
export const ignores = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/.next/**',
  '**/.turbo/**',
  '**/coverage/**',
  '**/*.generated.*',
  'assets/**',
];

/**
 * Rules shared by every workspace package.
 *
 * Framework-specific rules (Next.js, NestJS) are layered on top by the app
 * that needs them — they are not forced onto packages that do not.
 */
export const sharedRules = {
  'no-console': ['warn', { allow: ['warn', 'error'] }],
  eqeqeq: ['error', 'smart'],
  'no-implicit-coercion': 'error',
  '@typescript-eslint/no-unused-vars': [
    'error',
    { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
  ],
  '@typescript-eslint/consistent-type-imports': [
    'error',
    { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
  ],
};

/**
 * Base BARFF ESLint configuration.
 *
 * `prettier` is applied last so formatting rules never fight Prettier.
 *
 * @param {import('typescript-eslint').ConfigArray} extra
 *   Additional config objects appended after the shared rules.
 * @returns {import('typescript-eslint').ConfigArray}
 */
export function createBaseConfig(extra = []) {
  return tseslint.config(
    { ignores },
    js.configs.recommended,
    ...tseslint.configs.recommended,
    { rules: /** @type {any} */ (sharedRules) },
    ...extra,
    prettier,
  );
}

export default createBaseConfig();
