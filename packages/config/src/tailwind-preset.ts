import {
  blur,
  brand,
  fontFamily,
  fontSize,
  motion,
  radius,
  screens,
  spacing,
} from './design-tokens.js';
import { cssVarRef, PRODUCT_ACCENT_SLUGS } from './theme.js';

/**
 * Minimal structural type for a Tailwind preset.
 *
 * Declared locally on purpose: `packages/config` must not depend on
 * `tailwindcss` at S01, because no app exists yet to pin a major version
 * against. The consuming app (S06) supplies the real `Config` type.
 */
export interface BarffTailwindPreset {
  darkMode: [strategy: 'selector', selector: string];
  theme: Record<string, unknown>;
}

/**
 * Tailwind preset.
 *
 * Every themed colour resolves to a `var(--barff-…)` rather than a literal.
 * That is the whole mechanism behind §16a: before this, Tailwind compiled
 * `.bg-surface-base{background-color:#08090b}` and there was simply no runtime
 * value for a toggle or a media query to change.
 *
 * The variables themselves live in `theme.css`, generated from `theme.ts`.
 *
 * `brand`, `spacing`, `radius` and the type scale stay literal: they do not
 * change between themes, and turning them into variables would add indirection
 * with nothing on the other end of it.
 *
 * ⚠ The `brand` colours are placeholders until BARFF supplies the brand
 * guideline (docs/OPEN-QUESTIONS.md → Q-011).
 */

/** Semantic colour scales, pointing at the custom properties. */
const themed = {
  surface: {
    base: cssVarRef('surface-base'),
    raised: cssVarRef('surface-raised'),
    overlay: cssVarRef('surface-overlay'),
    inset: cssVarRef('surface-inset'),
    glass: cssVarRef('surface-glass'),
    glassStrong: cssVarRef('surface-glass-strong'),
  },
  border: {
    subtle: cssVarRef('border-subtle'),
    DEFAULT: cssVarRef('border-default'),
    strong: cssVarRef('border-strong'),
    brand: cssVarRef('border-accent'),
  },
  content: {
    primary: cssVarRef('content-primary'),
    secondary: cssVarRef('content-secondary'),
    muted: cssVarRef('content-muted'),
    disabled: cssVarRef('content-disabled'),
    inverse: cssVarRef('content-inverse'),
    onFill: cssVarRef('content-on-fill'),
  },
  accent: {
    DEFAULT: cssVarRef('accent'),
    hover: cssVarRef('accent-hover'),
    text: cssVarRef('accent-text'),
    soft: cssVarRef('accent-soft'),
    /** §17a's reactive accent. Decorative use only — glow and highlights. */
    glow: cssVarRef('accent-glow'),
    ...Object.fromEntries(
      PRODUCT_ACCENT_SLUGS.map((slug) => [slug, cssVarRef(`accent-product-${slug}`)]),
    ),
  },
  state: {
    success: cssVarRef('state-success'),
    successFill: cssVarRef('state-success-fill'),
    warning: cssVarRef('state-warning'),
    warningFill: cssVarRef('state-warning-fill'),
    danger: cssVarRef('state-danger'),
    dangerFill: cssVarRef('state-danger-fill'),
    info: cssVarRef('state-info'),
    infoFill: cssVarRef('state-info-fill'),
  },
} as const;

const themedShadow = {
  subtle: cssVarRef('shadow-subtle'),
  card: cssVarRef('shadow-card'),
  overlay: cssVarRef('shadow-overlay'),
  focus: cssVarRef('shadow-focus'),
} as const;
export const barffTailwindPreset: BarffTailwindPreset = {
  // Matches how the theme is actually switched: a `data-theme` attribute on
  // <html>, set by the toggle and by the pre-hydration script. `darkMode:
  // 'class'` was left over from S07 and matched nothing — a `dark:` utility
  // written against it would simply never have applied.
  //
  // Components should not need `dark:` at all: the custom properties already
  // carry both themes. It is declared so that the escape hatch, if it is ever
  // genuinely needed, keys off the real mechanism.
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    screens,
    fontFamily,
    fontSize,
    borderRadius: radius,
    backdropBlur: blur,
    boxShadow: themedShadow,
    extend: {
      colors: {
        surface: themed.surface,
        border: themed.border,
        content: themed.content,
        accent: themed.accent,
        brand,
        state: themed.state,
      },
      borderColor: themed.border,
      spacing,
      transitionDuration: motion.duration,
      transitionTimingFunction: motion.easing,
    },
  },
};

export default barffTailwindPreset;
