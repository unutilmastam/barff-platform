import { barffTailwindPreset } from '@barff/config';

/**
 * Tailwind configuration.
 *
 * Tailwind v4 is CSS-first, but `globals.css` loads this file with `@config`
 * on purpose: the BARFF design tokens live in `@barff/config` as TypeScript
 * (`design-tokens.ts`), and that is the single source of truth S01 established.
 * Re-declaring the palette in a CSS `@theme` block would duplicate every value,
 * and the copies would drift the first time a colour changes.
 *
 * ⚠ The brand ramp is a placeholder until BARFF supplies the real green
 * (docs/OPEN-QUESTIONS.md → Q-011).
 */
export default {
  ...barffTailwindPreset,
  content: ['./src/app/**/*.{ts,tsx}', './src/components/**/*.{ts,tsx}', './src/lib/**/*.{ts,tsx}'],
};
