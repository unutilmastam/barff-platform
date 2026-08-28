import { type CSSProperties } from 'react';
import { cssVar, cssVarRef, PRODUCT_ACCENT_SLUGS, type ProductAccent } from '@barff/config';

export { PRODUCT_ACCENT_SLUGS, type ProductAccent };

/**
 * The reactive product accent of `CLAUDE.md` §17a.
 *
 * S12 hangs this on a bottle: hovering one sets `--barff-accent-glow` on a
 * container, the registered property transitions, and every glow and highlight
 * beneath follows. **No re-render** — the value is assigned by CSS inheritance,
 * which is what §17a asks for and also why it costs nothing.
 *
 * What the accent may drive is deliberately narrow: glow, highlights, small
 * decorative accents. Body text, surfaces and borders never read it. That is
 * not a style preference — it is what makes §17a's "contrast must stay AA at
 * every point of the transition" structurally true rather than a claim about
 * animation frames, because the things that must stay AA are not the things
 * that move. Every accent is *also* held to 3:1 against both themes' surfaces
 * in `@barff/config`'s contrast test, so decorative-but-visible use is safe too.
 *
 * ⚠ The colours themselves are placeholders (Q-028).
 */
export function accentGlowStyle(slug: ProductAccent): CSSProperties {
  // A custom property is not in React's CSSProperties keyset, hence the cast.
  // Narrowed to one place rather than repeated at every call site.
  return { [cssVar('accent-glow')]: cssVarRef(`accent-product-${slug}`) } as CSSProperties;
}

/**
 * Returns the accent to the theme's own.
 *
 * Needed because §17a has no hover on touch devices: S12 drives the accent from
 * viewport-centre detection there, and needs a defined way back to neutral when
 * nothing is centred.
 */
export function resetAccentGlowStyle(): CSSProperties {
  return { [cssVar('accent-glow')]: cssVarRef('accent') } as CSSProperties;
}

export function isProductAccent(value: string): value is ProductAccent {
  return (PRODUCT_ACCENT_SLUGS as readonly string[]).includes(value);
}
