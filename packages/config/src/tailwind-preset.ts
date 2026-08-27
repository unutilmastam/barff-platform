import {
  blur,
  border,
  brand,
  fontFamily,
  fontSize,
  motion,
  radius,
  screens,
  shadow,
  spacing,
  state,
  surface,
  text,
} from './design-tokens.js';

/**
 * Minimal structural type for a Tailwind preset.
 *
 * Declared locally on purpose: `packages/config` must not depend on
 * `tailwindcss` at S01, because no app exists yet to pin a major version
 * against. The consuming app (S06) supplies the real `Config` type.
 */
export interface BarffTailwindPreset {
  darkMode: 'class';
  theme: Record<string, unknown>;
}

/**
 * Tailwind v3-style preset built from `design-tokens.ts`.
 *
 * If S06 adopts Tailwind v4 (CSS-first `@theme`), import `designTokens`
 * directly and emit custom properties instead — the token values are the same
 * either way, and this preset can then be deleted.
 *
 * ⚠ The `brand` colours are placeholders until BARFF supplies the brand
 * guideline (docs/OPEN-QUESTIONS.md → Q-011).
 */
export const barffTailwindPreset: BarffTailwindPreset = {
  // The site is dark-first (§16). `class` keeps a light mode possible for
  // invoices and PDF exports without inverting the whole app.
  darkMode: 'class',
  theme: {
    screens,
    fontFamily,
    fontSize,
    borderRadius: radius,
    backdropBlur: blur,
    boxShadow: shadow,
    extend: {
      colors: {
        surface,
        border,
        content: text,
        brand,
        state,
      },
      borderColor: border,
      spacing,
      transitionDuration: motion.duration,
      transitionTimingFunction: motion.easing,
    },
  },
};

export default barffTailwindPreset;
