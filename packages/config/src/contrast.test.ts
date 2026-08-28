import { describe, expect, it } from 'vitest';
import { brand, state, surface, text as content } from './design-tokens.js';

/**
 * WCAG contrast on the token pairs the design system actually renders.
 *
 * Asserted rather than reviewed: a palette is adjusted by eye, and "does white
 * on this red still pass?" is not a question anyone answers by looking. Two of
 * these pairs were below the minimum when first written and were only caught by
 * running a real audit.
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
const AA_LARGE = 3;

describe('contrastRatio', () => {
  it('computes the known extremes', () => {
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 1);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
  });

  it('is symmetric', () => {
    expect(contrastRatio('#F5F7F6', '#08090B')).toBeCloseTo(contrastRatio('#08090B', '#F5F7F6'), 5);
  });
});

describe('body text on every surface', () => {
  const surfaces = [
    ['base', surface.base],
    ['raised', surface.raised],
    ['overlay', surface.overlay],
    ['inset', surface.inset],
  ] as const;

  it.each(surfaces)('content.primary on surface.%s', (_name, background) => {
    expect(contrastRatio(content.primary, background)).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it.each(surfaces)('content.secondary on surface.%s', (_name, background) => {
    expect(contrastRatio(content.secondary, background)).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it.each(surfaces)('content.muted on surface.%s', (_name, background) => {
    // `muted` is used for captions and placeholders — real text, so it takes
    // the full normal-text threshold, not the large-text one.
    expect(contrastRatio(content.muted, background)).toBeGreaterThanOrEqual(AA_NORMAL);
  });
});

describe('filled controls', () => {
  it('inverse text on the brand fill', () => {
    expect(contrastRatio(content.inverse, brand[500])).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it('primary text on the danger fill', () => {
    // The pair that failed at 3.55:1 before `dangerFill` was split out.
    expect(contrastRatio(content.primary, state.dangerFill)).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it('keeps the two danger tokens genuinely distinct', () => {
    // If someone "simplifies" these back into one value, one of the two uses
    // silently drops below the minimum. This is the guard against that.
    expect(state.danger).not.toBe(state.dangerFill);
    expect(contrastRatio(state.danger, surface.base)).toBeGreaterThanOrEqual(AA_NORMAL);
    expect(contrastRatio(content.primary, state.dangerFill)).toBeGreaterThanOrEqual(AA_NORMAL);
  });
});

describe('status colours as text on the base surface', () => {
  it.each([
    ['success', state.success],
    ['warning', state.warning],
    ['danger', state.danger],
    ['info', state.info],
  ])('state.%s', (_name, colour) => {
    expect(contrastRatio(colour, surface.base)).toBeGreaterThanOrEqual(AA_NORMAL);
  });
});

describe('non-text contrast', () => {
  it('the brand accent is distinguishable against the base surface', () => {
    // Focus rings and accents are UI boundaries: 3:1 under SC 1.4.11.
    expect(contrastRatio(brand[500], surface.base)).toBeGreaterThanOrEqual(AA_LARGE);
  });
});
