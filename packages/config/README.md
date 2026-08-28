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

`src/theme.ts` layers **semantic** tokens on top: each names the _role_ a colour
plays and gives it a value per theme (§16a). `src/tailwind-preset.ts` points
Tailwind at `var(--barff-…)` for every one of them, so a theme can actually be
switched at runtime.

Light is authored, not derived. On dark, borders are white at low alpha and
glass is a white film — both invisible on a light surface — and the amber that
reads cleanly on near-black fails badly on near-white. An inversion produces a
theme that is wrong in a dozen specific ways.

```bash
pnpm --filter @barff/config generate:theme   # rewrites theme.css from theme.ts
```

`theme.css` is generated and committed, and `theme-css.test.ts` fails if the two
disagree — one source of truth, no build step to forget.

`contrast.test.ts` asserts every rendered pair against WCAG AA in **both**
themes, plus the seven product accents against the 3:1 non-text minimum. The
light palette was tuned against those assertions rather than the other way
round, and two of them (`content-on-fill`, `accent-hover`) exist because the
test refused a value that looked fine.
