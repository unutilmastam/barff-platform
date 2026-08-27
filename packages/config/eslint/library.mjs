// @ts-check
import { createBaseConfig } from './base.mjs';

/**
 * ESLint preset for `packages/*` libraries.
 *
 * Libraries are consumed by the browser apps as well as the API, so they must
 * stay runtime-agnostic: no `console`, no direct `process.env` access. Config
 * values are passed in by the consumer instead.
 */
export default createBaseConfig([
  {
    files: ['src/**/*.ts'],
    rules: {
      'no-console': 'error',
      'no-restricted-globals': [
        'error',
        {
          name: 'process',
          message:
            'Shared packages must stay runtime-agnostic. Pass configuration in from the consuming app or service.',
        },
      ],
    },
  },
  {
    // Tests may use whatever they need.
    files: ['src/**/*.test.ts'],
    rules: {
      'no-console': 'off',
      'no-restricted-globals': 'off',
    },
  },
]);
