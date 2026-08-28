/**
 * Semantic theme tokens — the layer that makes `CLAUDE.md` §16a possible.
 *
 * ## Why this exists
 *
 * `design-tokens.ts` holds raw values, and until now Tailwind compiled them
 * straight into utility classes: `.bg-surface-base{background-color:#08090b}`.
 * That is a *single-theme* design by construction — there is no runtime value
 * to change, so no toggle and no `prefers-color-scheme` query can switch
 * anything. §16a needs the values to reach CSS as custom properties instead.
 *
 * So this file names each **role** a colour plays and gives it a value per
 * theme. The Tailwind preset points at `var(--barff-…)`, and `theme.css`
 * defines those variables twice.
 *
 * ## Light is not an inversion
 *
 * §16a is explicit, and the palette below shows why it has to be. On dark,
 * borders are white at low alpha and glass is a white film; both are invisible
 * on a light surface. Status colours flip the other way — the amber that reads
 * cleanly on near-black fails badly on near-white — so light needs its own,
 * darker values, not a mathematical inverse.
 *
 * Every pair here is asserted against WCAG AA in `contrast.test.ts`, in both
 * themes. Values that look right and fail the ratio are exactly what that test
 * exists to catch.
 */

export const THEMES = ['dark', 'light'] as const;
export type Theme = (typeof THEMES)[number];

/** One token, valued per theme. */
export interface ThemedValue {
  dark: string;
  light: string;
}

/**
 * Surfaces, borders and text.
 *
 * Dark values are S07's, unchanged — the dark art direction is the primary one
 * (§16a) and this step must not redesign it.
 */
export const semanticColors = {
  'surface-base': { dark: '#08090B', light: '#F4F6F5' },
  'surface-raised': { dark: '#0E1013', light: '#FFFFFF' },
  'surface-overlay': { dark: '#15181C', light: '#FFFFFF' },
  'surface-inset': { dark: '#050607', light: '#E7EBE9' },

  // A film of the *opposite* end of the scale: white over dark, ink over light.
  // Inverting the dark value would produce a white film on white.
  'surface-glass': { dark: 'rgba(255, 255, 255, 0.04)', light: 'rgba(8, 9, 11, 0.04)' },
  'surface-glass-strong': { dark: 'rgba(255, 255, 255, 0.07)', light: 'rgba(8, 9, 11, 0.07)' },

  'border-subtle': { dark: 'rgba(255, 255, 255, 0.08)', light: 'rgba(8, 9, 11, 0.10)' },
  'border-default': { dark: 'rgba(255, 255, 255, 0.12)', light: 'rgba(8, 9, 11, 0.16)' },
  'border-strong': { dark: 'rgba(255, 255, 255, 0.20)', light: 'rgba(8, 9, 11, 0.28)' },
  'border-accent': { dark: 'rgba(46, 182, 106, 0.40)', light: 'rgba(26, 116, 68, 0.40)' },

  'content-primary': { dark: '#F5F7F6', light: '#0B0D0C' },
  'content-secondary': { dark: '#B4BCB8', light: '#414845' },
  // Captions and placeholders are live text, so `muted` carries the full
  // 4.5:1 threshold in both themes — the S07 fix that this must not undo.
  'content-muted': { dark: '#7C8783', light: '#565E5A' },
  // Disabled text is exempt from WCAG's minimum (inactive controls), and it is
  // the one pair the contrast test deliberately does not assert.
  'content-disabled': { dark: '#4E5754', light: '#9AA19E' },
  /**
   * Text on the solid **accent** fill.
   *
   * Distinct from `content-on-fill` below, and the difference is not cosmetic:
   * in dark mode the accent fill is a bright green that needs near-black text,
   * while the status fills are dark and need near-white. One token for both
   * would fail one of them — the contrast test found exactly that when this
   * palette was first written.
   */
  'content-inverse': { dark: '#08090B', light: '#FFFFFF' },
  /** Text on a solid **status** fill (success, warning, danger, info). */
  'content-on-fill': { dark: '#F5F7F6', light: '#FFFFFF' },

  /**
   * The brand accent, in the two jobs it has to do.
   *
   * `accent` is the fill; `accent-text` is the readable-on-surface variant.
   * They differ per theme for the reason the danger colour already had to be
   * split in S07: a green that reads on near-black is too light to fill under
   * white text, and the dark green that fills correctly on light is too dark
   * to read on black.
   *
   * ⚠ REPLACE_WITH_REAL_DATA — the ramp these come from is a placeholder until
   * BARFF supplies the brand guideline (Q-011).
   */
  accent: { dark: '#2EB66A', light: '#1A7444' },
  /**
   * Hover on the accent fill.
   *
   * Lighter on dark, *darker* on light — the direction of "more emphasis"
   * flips with the theme, which is the same reason the fill and the text
   * variants cannot be one value.
   */
  'accent-hover': { dark: '#40C578', light: '#155A35' },
  'accent-text': { dark: '#2EB66A', light: '#166437' },
  'accent-soft': { dark: 'rgba(46, 182, 106, 0.12)', light: 'rgba(26, 116, 68, 0.10)' },

  'state-success': { dark: '#2EB66A', light: '#136B3D' },
  'state-success-fill': { dark: '#15683D', light: '#136B3D' },
  'state-warning': { dark: '#E0A32E', light: '#7A5200' },
  'state-warning-fill': { dark: '#6E4C00', light: '#7A5200' },
  'state-danger': { dark: '#E05252', light: '#A81F1F' },
  'state-danger-fill': { dark: '#C43C3C', light: '#A81F1F' },
  'state-info': { dark: '#4A9EE0', light: '#15558F' },
  'state-info-fill': { dark: '#14528F', light: '#15558F' },
} as const satisfies Record<string, ThemedValue>;

export type SemanticColor = keyof typeof semanticColors;

/**
 * Shadows.
 *
 * §16a lists them alongside surfaces and borders for a reason: a shadow that
 * reads as depth on near-black is a smudge on near-white. Light gets its own,
 * much lighter values rather than the dark ones at a different opacity.
 */
export const semanticShadows = {
  'shadow-subtle': {
    dark: '0 1px 2px rgba(0, 0, 0, 0.30)',
    light: '0 1px 2px rgba(8, 9, 11, 0.06)',
  },
  'shadow-card': {
    dark: '0 8px 24px rgba(0, 0, 0, 0.35)',
    light: '0 8px 24px rgba(8, 9, 11, 0.08)',
  },
  'shadow-overlay': {
    dark: '0 24px 64px rgba(0, 0, 0, 0.50)',
    light: '0 24px 64px rgba(8, 9, 11, 0.14)',
  },
} as const satisfies Record<string, ThemedValue>;

/**
 * Product accent colours (§17a).
 *
 * Hovering a bottle shifts `--barff-accent-glow` to one of these. They are
 * **decorative only** — glow, highlight, small accents — and never touch body
 * text, surfaces or borders, which is what makes §17a's "contrast must stay AA
 * at every point of the transition" tractable rather than a promise about
 * animation frames.
 *
 * Each value is still held to 3:1 against its theme's base surface (WCAG's
 * non-text minimum) in `contrast.test.ts`, and that gives the transition
 * guarantee for free: contrast against a fixed background is monotonic in the
 * foreground's relative luminance, and interpolating sRGB channels between two
 * colours keeps every linearised channel — and therefore the luminance —
 * between the endpoints. Both ends passing means every frame passes.
 *
 * That guarantee is specific to sRGB interpolation. `oklch`/`color-mix` in
 * oklab can overshoot chroma mid-transition, so the transition is declared on
 * the custom property in sRGB rather than left to whatever the browser picks.
 *
 * ⚠ REPLACE_WITH_REAL_DATA — BARFF has not supplied these (Q-028). Sampling
 * them from the label artwork is not an option either: those renders are AI
 * mockups (Q-022).
 */
export const productAccents = {
  granat: { dark: '#E24B5A', light: '#A81E2E' },
  apelsin: { dark: '#F0993C', light: '#8A5100' },
  olcha: { dark: '#D9556E', light: '#9E2247' },
  shaftoli: { dark: '#F0A878', light: '#8F4A28' },
  olma: { dark: '#8FD14F', light: '#456F14' },
  multifrukt: { dark: '#F0C33C', light: '#6E5200' },
  'qulupnay-ananas': { dark: '#F06A9A', light: '#A32060' },
} as const satisfies Record<string, ThemedValue>;

export type ProductAccent = keyof typeof productAccents;

export const PRODUCT_ACCENT_SLUGS = Object.keys(productAccents) as ProductAccent[];

/** Prefix for every custom property this file defines. */
export const CSS_VAR_PREFIX = '--barff';

export const cssVar = (token: string): string => `${CSS_VAR_PREFIX}-${token}`;
/** The `var(…)` reference the Tailwind preset points at. */
export const cssVarRef = (token: string): string => `var(${cssVar(token)})`;

const THEMED_TOKENS: Record<string, ThemedValue> = {
  ...semanticColors,
  ...semanticShadows,
  ...Object.fromEntries(
    Object.entries(productAccents).map(([slug, value]) => [`accent-product-${slug}`, value]),
  ),
};

/** Every custom property, valued for one theme. */
export function themeVariables(theme: Theme): Record<string, string> {
  return Object.fromEntries(
    Object.entries(THEMED_TOKENS).map(([token, value]) => [cssVar(token), value[theme]]),
  );
}

const declarations = (theme: Theme, indent: string): string =>
  Object.entries(themeVariables(theme))
    .map(([name, value]) => `${indent}${name}: ${value};`)
    .join('\n');

/**
 * The stylesheet that carries both themes.
 *
 * Generated rather than hand-written, and checked in rather than built at
 * runtime: `theme-css.test.ts` regenerates it and fails if the committed file
 * has drifted, so there is one source of truth and no build step to forget.
 *
 * Cascade order is deliberate. The media query and the `[data-theme]` selector
 * have identical specificity, so the explicit attribute wins only because it
 * comes last — a manual choice must beat the operating system's.
 */
export function renderThemeCss(): string {
  return `/*
 * GENERATED FILE — do not edit.
 *
 * Source: packages/config/src/theme.ts
 * Regenerate: pnpm --filter @barff/config generate:theme
 *
 * theme-css.test.ts fails if this file and the tokens disagree.
 */

:root {
  color-scheme: dark;

${declarations('dark', '  ')}

  /*
   * The reactive accent of CLAUDE.md §17a. Defaults to the theme accent and is
   * reassigned on product hover; it drives glow and highlights only, never
   * text, surfaces or borders.
   */
  ${cssVar('accent-glow')}: ${cssVarRef('accent')};

  /*
   * The focus ring is one declaration for both themes because it is written in
   * terms of the others: the inner gap takes the page colour, so it follows
   * whichever theme is active instead of hard-coding a near-black that would be
   * simply wrong on light.
   */
  ${cssVar('shadow-focus')}: 0 0 0 2px ${cssVarRef('surface-base')}, 0 0 0 4px ${cssVarRef('accent')};
}

/* No explicit choice yet: follow the operating system. */
@media (prefers-color-scheme: light) {
  :root:not([data-theme='dark']) {
    color-scheme: light;

${declarations('light', '    ')}
  }
}

/* An explicit choice, persisted by the toggle. Last, so it wins. */
:root[data-theme='light'] {
  color-scheme: light;

${declarations('light', '  ')}
}

:root[data-theme='dark'] {
  color-scheme: dark;

${declarations('dark', '  ')}
}
`;
}
