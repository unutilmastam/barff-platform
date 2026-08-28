/**
 * BARFF design tokens — the single source of truth for the visual language
 * described in `CLAUDE.md` §16.
 *
 * These are framework-neutral values. `tailwind-preset.ts` shapes them into a
 * Tailwind v3 preset; a Tailwind v4 app consumes the same object from an
 * `@theme` block. Nothing here should be duplicated inside a component.
 *
 * ⚠ REPLACE_WITH_REAL_DATA — the `brand` ramp below is a placeholder. BARFF has
 * not supplied a brand guideline or the exact green HEX value
 * (see docs/OPEN-QUESTIONS.md → Q-011). Do not treat these values as the
 * approved brand colour.
 */

/**
 * Layered dark surfaces. `base` is the page background; each step up sits
 * visually closer to the viewer (§16 "deep black/charcoal layered backgrounds").
 */
export const surface = {
  base: '#08090B',
  raised: '#0E1013',
  overlay: '#15181C',
  inset: '#050607',
  /** Translucent fill for glass cards. Pair with `blur.glass`. */
  glass: 'rgba(255, 255, 255, 0.04)',
  glassStrong: 'rgba(255, 255, 255, 0.07)',
} as const;

/** Thin borders only — §16 explicitly rules out heavy outlines. */
export const border = {
  subtle: 'rgba(255, 255, 255, 0.08)',
  DEFAULT: 'rgba(255, 255, 255, 0.12)',
  strong: 'rgba(255, 255, 255, 0.20)',
  brand: 'rgba(46, 182, 106, 0.40)',
} as const;

export const text = {
  primary: '#F5F7F6',
  secondary: '#B4BCB8',
  muted: '#7C8783',
  disabled: '#4E5754',
  inverse: '#08090B',
} as const;

/**
 * ⚠ PLACEHOLDER brand ramp (Q-011). Structure is correct; values are not
 * approved. `500` is the accent used for CTAs and highlights.
 */
export const brand = {
  50: '#E9F9EF',
  100: '#C9F0D8',
  200: '#95E2B4',
  300: '#63D391',
  400: '#40C578',
  500: '#2EB66A',
  600: '#219355',
  700: '#1A7444',
  800: '#155A35',
  900: '#104227',
  950: '#092817',
} as const;

/** Feedback colours. Not brand colours — these stay stable if the green changes. */
export const state = {
  success: '#2EB66A',
  warning: '#E0A32E',
  /**
   * Danger as **text or border** on a dark surface — 5.22:1 on `surface.base`.
   */
  danger: '#E05252',
  /**
   * Danger as a **filled background** under `content.primary` — 4.81:1.
   *
   * Two tokens because one colour cannot do both jobs: readable red text on a
   * dark surface has to be light, and a red fill under white text has to be
   * dark. Asking a single value to satisfy both is arithmetically impossible,
   * and the compromise fails one of them silently. Both ratios are asserted in
   * `contrast.test.ts`.
   */
  dangerFill: '#C43C3C',
  info: '#4A9EE0',
} as const;

/**
 * Type scale. Large, modern typography (§16) — the display sizes are meant for
 * hero and section headers, not body copy.
 *
 * Each entry is `[fontSize, { lineHeight, letterSpacing }]` so it can be handed
 * to Tailwind's `fontSize` key unchanged.
 */
export const fontSize = {
  xs: ['0.75rem', { lineHeight: '1rem', letterSpacing: '0.01em' }],
  sm: ['0.875rem', { lineHeight: '1.25rem', letterSpacing: '0' }],
  base: ['1rem', { lineHeight: '1.6', letterSpacing: '0' }],
  lg: ['1.125rem', { lineHeight: '1.6', letterSpacing: '-0.005em' }],
  xl: ['1.375rem', { lineHeight: '1.45', letterSpacing: '-0.01em' }],
  '2xl': ['1.75rem', { lineHeight: '1.3', letterSpacing: '-0.015em' }],
  '3xl': ['2.25rem', { lineHeight: '1.2', letterSpacing: '-0.02em' }],
  '4xl': ['3rem', { lineHeight: '1.1', letterSpacing: '-0.025em' }],
  '5xl': ['4rem', { lineHeight: '1.05', letterSpacing: '-0.03em' }],
  '6xl': ['5.25rem', { lineHeight: '1', letterSpacing: '-0.035em' }],
} as const;

export const fontFamily = {
  /**
   * ⚠ REPLACE_WITH_REAL_DATA — no brand typeface has been supplied (Q-011).
   * The stack below is a system fallback so layout work can proceed.
   */
  sans: ['var(--font-sans)', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
  mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
} as const;

/** Premium whitespace (§16): the scale runs further than Tailwind's default. */
export const spacing = {
  section: '7.5rem',
  sectionSm: '4.5rem',
  gutter: '1.25rem',
  gutterLg: '2rem',
} as const;

/** Restrained rounding — §16 rules out "excessive rounded cards". */
export const radius = {
  none: '0px',
  sm: '2px',
  DEFAULT: '4px',
  md: '6px',
  lg: '10px',
  xl: '14px',
  full: '9999px',
} as const;

export const blur = {
  glass: '16px',
  glassStrong: '28px',
} as const;

export const shadow = {
  /** Depth comes from layered surfaces and thin borders, not heavy shadows. */
  subtle: '0 1px 2px rgba(0, 0, 0, 0.30)',
  card: '0 8px 24px rgba(0, 0, 0, 0.35)',
  overlay: '0 24px 64px rgba(0, 0, 0, 0.50)',
  /** Focus ring — always visible, never removed (§16 accessibility, S07). */
  focus: '0 0 0 2px #08090B, 0 0 0 4px #2EB66A',
} as const;

/** Shared motion timings so S16 does not end up with ad-hoc easings per component. */
export const motion = {
  duration: {
    instant: '80ms',
    fast: '160ms',
    DEFAULT: '240ms',
    slow: '420ms',
    reveal: '720ms',
  },
  easing: {
    /** Default UI easing — quick out, gentle settle. */
    DEFAULT: 'cubic-bezier(0.22, 1, 0.36, 1)',
    in: 'cubic-bezier(0.4, 0, 1, 1)',
    out: 'cubic-bezier(0, 0, 0.2, 1)',
    inOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
  },
} as const;

/** Breakpoints. Mobile-first: dealers and drivers work from phones. */
export const screens = {
  xs: '360px',
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

export const designTokens = {
  surface,
  border,
  text,
  brand,
  state,
  fontSize,
  fontFamily,
  spacing,
  radius,
  blur,
  shadow,
  motion,
  screens,
} as const;

export type DesignTokens = typeof designTokens;
