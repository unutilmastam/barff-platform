import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { renderThemeCss, semanticColors, themeVariables } from './theme.js';

const themeCssPath = fileURLToPath(new URL('../theme.css', import.meta.url));

describe('theme.css', () => {
  it('matches the tokens it was generated from', () => {
    // The whole point of generating and committing the file rather than
    // building it: a token changed without regenerating would otherwise ship a
    // stylesheet that silently disagrees with the TypeScript everything else
    // reads.
    expect(readFileSync(themeCssPath, 'utf8')).toBe(renderThemeCss());
  });

  it('defines every token in both themes', () => {
    const css = renderThemeCss();
    for (const name of Object.keys(themeVariables('dark'))) {
      // Twice for the explicit selectors, once in the media query: three at
      // minimum, so a token missing from one theme cannot slip through.
      expect(css.split(`${name}:`).length - 1).toBeGreaterThanOrEqual(3);
    }
  });

  it('lets an explicit choice win over the operating system', () => {
    const css = renderThemeCss();
    // Same specificity, so source order is the only thing deciding. If the
    // media query moved below the attribute selectors, the toggle would stop
    // working for anyone whose OS is set to light — and only for them.
    expect(css.indexOf('@media (prefers-color-scheme: light)')).toBeLessThan(
      css.indexOf("[data-theme='light']"),
    );
  });

  it('keeps the focus ring theme-relative', () => {
    // S07 hard-coded the dark page colour into the ring's inner gap. In light
    // mode that is a black halo around every focused control.
    expect(renderThemeCss()).toContain(
      '--barff-shadow-focus: 0 0 0 2px var(--barff-surface-base), 0 0 0 4px var(--barff-accent);',
    );
  });

  it('starts the reactive accent at the theme accent', () => {
    expect(renderThemeCss()).toContain('--barff-accent-glow: var(--barff-accent);');
  });

  it('gives light its own surface, border and shadow values', () => {
    // §16a: "a first-class theme, not an inversion". A light border that is
    // still white-on-white is the failure this guards against.
    for (const token of ['border-subtle', 'border-default', 'surface-glass'] as const) {
      expect(semanticColors[token].light).not.toBe(semanticColors[token].dark);
      expect(semanticColors[token].light).not.toContain('255, 255, 255');
    }
  });
});
