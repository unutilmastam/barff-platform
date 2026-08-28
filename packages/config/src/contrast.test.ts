import { describe, expect, it } from 'vitest';
import { productAccents, semanticColors, THEMES, type SemanticColor, type Theme } from './theme.js';

/**
 * WCAG contrast on the token pairs the design system actually renders — in
 * **both** themes (`CLAUDE.md` §16a).
 *
 * Asserted rather than reviewed: a palette is adjusted by eye, and "does white
 * on this red still pass?" is not a question anyone answers by looking. Two
 * pairs were below the minimum when S07 wrote this file and were only caught by
 * running a real audit; the light palette added here was tuned against these
 * assertions rather than the other way round.
 */
function relativeLuminance(hex: string): number {
  const channels = [1, 3, 5]
    .map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255)
    .map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

export function contrastRatio(foreground: string, background: string): number {
  const [lighter, darker] = [relativeLuminance(foreground), relativeLuminance(background)].sort(
    (a, b) => b - a,
  );
  return (lighter! + 0.05) / (darker! + 0.05);
}

/** WCAG 2.2 AA: 4.5:1 for normal text, 3:1 for large text and UI boundaries. */
const AA_NORMAL = 4.5;
const AA_NON_TEXT = 3;

const token = (name: SemanticColor, theme: Theme): string => semanticColors[name][theme];

/** Every surface a component can sit on. Translucent films are not backgrounds. */
const SURFACES = ['surface-base', 'surface-raised', 'surface-overlay', 'surface-inset'] as const;

describe('contrastRatio', () => {
  it('computes the known extremes', () => {
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 1);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
  });

  it('is symmetric', () => {
    expect(contrastRatio('#F5F7F6', '#08090B')).toBeCloseTo(contrastRatio('#08090B', '#F5F7F6'), 5);
  });
});

describe.each(THEMES)('%s theme', (theme) => {
  describe('body text on every surface', () => {
    it.each(SURFACES)(`content-primary on %s`, (surface) => {
      expect(
        contrastRatio(token('content-primary', theme), token(surface, theme)),
      ).toBeGreaterThanOrEqual(AA_NORMAL);
    });

    it.each(SURFACES)(`content-secondary on %s`, (surface) => {
      expect(
        contrastRatio(token('content-secondary', theme), token(surface, theme)),
      ).toBeGreaterThanOrEqual(AA_NORMAL);
    });

    it.each(SURFACES)(`content-muted on %s`, (surface) => {
      // `muted` is captions and placeholders — real text a visitor reads, so it
      // takes the full normal-text threshold, not the large-text one. A
      // placeholder is not a disabled control.
      expect(
        contrastRatio(token('content-muted', theme), token(surface, theme)),
      ).toBeGreaterThanOrEqual(AA_NORMAL);
    });
  });

  describe('accent and status text on every surface', () => {
    const TEXT_TOKENS = [
      'accent-text',
      'state-success',
      'state-warning',
      'state-danger',
      'state-info',
    ] as const;

    it.each(TEXT_TOKENS)(`%s on surface-base`, (name) => {
      expect(
        contrastRatio(token(name, theme), token('surface-base', theme)),
      ).toBeGreaterThanOrEqual(AA_NORMAL);
    });

    it.each(TEXT_TOKENS)(`%s on surface-raised`, (name) => {
      expect(
        contrastRatio(token(name, theme), token('surface-raised', theme)),
      ).toBeGreaterThanOrEqual(AA_NORMAL);
    });
  });

  describe('filled controls', () => {
    const STATUS_FILLS = [
      'state-success-fill',
      'state-warning-fill',
      'state-danger-fill',
      'state-info-fill',
    ] as const;

    it.each(['accent', 'accent-hover'] as const)('content-inverse on %s', (fill) => {
      // Hover is included because a button spends real time in that state, and
      // a hover colour that fails is a button that becomes unreadable exactly
      // when the user is about to press it.
      expect(
        contrastRatio(token('content-inverse', theme), token(fill, theme)),
      ).toBeGreaterThanOrEqual(AA_NORMAL);
    });

    it.each(STATUS_FILLS)(`content-on-fill on %s`, (fill) => {
      // A separate foreground from `content-inverse` on purpose: in dark mode
      // the accent fill is bright and the status fills are dark, so they need
      // opposite text colours. Asserting one token against both is what
      // surfaced the need for two.
      expect(
        contrastRatio(token('content-on-fill', theme), token(fill, theme)),
      ).toBeGreaterThanOrEqual(AA_NORMAL);
    });

    it('keeps the readable and the fillable variants genuinely distinct where they must be', () => {
      // One colour cannot do both jobs: text on a dark surface has to be light,
      // and a fill under light text has to be dark. Asking a single value to
      // satisfy both is arithmetically impossible, and the compromise fails one
      // of them silently — which is how S07 shipped a 3.55:1 danger fill.
      if (theme === 'dark') {
        expect(token('state-danger', theme)).not.toBe(token('state-danger-fill', theme));
        expect(token('state-warning', theme)).not.toBe(token('state-warning-fill', theme));
      }
    });
  });

  describe('product accents (§17a)', () => {
    it.each(Object.keys(productAccents))('%s clears the non-text minimum', (slug) => {
      // Decorative only — glow and highlights, never text — so 3:1 is the
      // right bar. Holding every accent to it is also what makes §17a's
      // "AA at every point of the transition" true without testing animation
      // frames: contrast against a fixed background is monotonic in the
      // foreground's luminance, and interpolating sRGB channels keeps the
      // luminance between the two endpoints. Both ends passing ⇒ all of it.
      const accent = productAccents[slug as keyof typeof productAccents][theme];
      expect(contrastRatio(accent, token('surface-base', theme))).toBeGreaterThanOrEqual(
        AA_NON_TEXT,
      );
      expect(contrastRatio(accent, token('surface-raised', theme))).toBeGreaterThanOrEqual(
        AA_NON_TEXT,
      );
    });

    it('gives each accent its own value per theme', () => {
      // A single accent set cannot work on both: a colour bright enough to glow
      // on near-black is washed out on near-white.
      for (const value of Object.values(productAccents)) {
        expect(value.dark).not.toBe(value.light);
      }
    });
  });
});

describe('the two themes are genuinely different', () => {
  it('shares no surface value', () => {
    for (const surface of SURFACES) {
      expect(semanticColors[surface].dark).not.toBe(semanticColors[surface].light);
    }
  });

  it('inverts the text/background relationship rather than reusing it', () => {
    // Sanity check that light really is light: primary text must be darker than
    // the page, and on dark it must be lighter.
    expect(relativeLuminance(token('content-primary', 'light'))).toBeLessThan(
      relativeLuminance(token('surface-base', 'light')),
    );
    expect(relativeLuminance(token('content-primary', 'dark'))).toBeGreaterThan(
      relativeLuminance(token('surface-base', 'dark')),
    );
  });
});
