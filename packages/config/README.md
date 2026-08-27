# @barff/config

Shared ESLint, TypeScript and Tailwind presets, plus the BARFF design tokens.

## TypeScript

Presets carry **`compilerOptions` only**. Relative paths inside an extended
config (`rootDir`, `include`, `exclude`) resolve against the preset file, not
against the project extending it — so each project declares its own `include`.

```jsonc
// packages/<name>/tsconfig.json
{
  "extends": "@barff/config/tsconfig/library.json",
  "include": ["src/**/*.ts"],
}
```

| Preset                  | For                                                |
| ----------------------- | -------------------------------------------------- |
| `tsconfig/base.json`    | Strict defaults everything inherits                |
| `tsconfig/library.json` | `packages/*` — typecheck only, emit is tsup's job  |
| `tsconfig/nestjs.json`  | `services/api` (S02) — CJS, decorators, Node types |
| `tsconfig/nextjs.json`  | `apps/*` (S06) — DOM libs, JSX, Next plugin        |

## ESLint

```js
// eslint.config.mjs
import { createBaseConfig } from '@barff/config/eslint/base';

export default createBaseConfig([/* framework-specific config objects */]);
```

`createBaseConfig` applies the shared ignores, `@eslint/js` recommended,
`typescript-eslint` recommended and the BARFF rules, then appends whatever you
pass and finishes with `eslint-config-prettier` — so formatting rules never
fight Prettier. `eslint/library.mjs` layers on the rules that keep
`packages/*` runtime-agnostic.

## Design tokens

`src/design-tokens.ts` is the single source of truth for the visual language in
`CLAUDE.md` §16 — layered dark surfaces, thin borders, restrained rounding,
large type scale, shared motion timings.

> ⚠ **The `brand` colour ramp and the font stack are placeholders.** BARFF has
> not supplied a brand guideline, the exact green HEX or a brand typeface — see
> `docs/OPEN-QUESTIONS.md` → Q-011. Do not treat these values as approved.

`src/tailwind-preset.ts` shapes those tokens into a Tailwind v3 preset. If S06
adopts Tailwind v4 (CSS-first `@theme`), import `designTokens` directly and emit
custom properties instead — the values are the same either way, and the preset
can then be deleted. The package intentionally does not depend on
`tailwindcss`: no app exists yet to pin a major version against.
