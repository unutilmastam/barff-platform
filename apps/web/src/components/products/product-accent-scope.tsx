'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { usePointerFine } from '@/hooks/use-pointer-fine';
import {
  ACCENT_SLUG_ATTRIBUTE as SLUG_ATTRIBUTE,
  accentGlowStyle,
  isProductAccent,
  resetAccentGlowStyle,
  type ProductAccent,
} from '@/lib/product-accent';

/**
 * Drives the page accent from the product in focus (`CLAUDE.md` §17a).
 *
 * Sets `--barff-accent-glow` on its own element; the value inherits, so every
 * glow and highlight beneath follows with no re-render of the cards themselves.
 *
 * Two input methods, because a touch screen has no hover:
 *
 * - **Fine pointer:** the product under the cursor wins. Delegated from this
 *   one element rather than a listener per card.
 * - **Coarse pointer:** the product nearest the vertical centre of the viewport
 *   wins, recomputed on scroll. §17a asks for exactly this, and it is the only
 *   honest option — `:hover` on touch sticks after a tap, leaving a state the
 *   visitor cannot get out of.
 *
 * The effect is decorative and carries no meaning, so a device where neither
 * path runs simply keeps the theme accent.
 */
export function ProductAccentScope({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [slug, setSlug] = useState<ProductAccent | null>(null);
  const isPointerFine = usePointerFine();

  useEffect(() => {
    const root = rootRef.current;
    if (root === null || !isPointerFine) return;

    const read = (target: EventTarget | null): ProductAccent | null => {
      if (!(target instanceof Element)) return null;
      const value = target.closest(`[${SLUG_ATTRIBUTE}]`)?.getAttribute(SLUG_ATTRIBUTE);
      return typeof value === 'string' && isProductAccent(value) ? value : null;
    };

    const onOver = (event: Event) => {
      const found = read(event.target);
      if (found !== null) setSlug(found);
    };
    // `mouseleave` on the container, not each card: moving between two cards
    // would otherwise clear the accent and re-set it, flickering on every gap.
    const onLeave = () => setSlug(null);

    root.addEventListener('mouseover', onOver);
    root.addEventListener('focusin', onOver);
    root.addEventListener('mouseleave', onLeave);
    root.addEventListener('focusout', onLeave);
    return () => {
      root.removeEventListener('mouseover', onOver);
      root.removeEventListener('focusin', onOver);
      root.removeEventListener('mouseleave', onLeave);
      root.removeEventListener('focusout', onLeave);
    };
  }, [isPointerFine]);

  useEffect(() => {
    const root = rootRef.current;
    if (root === null || isPointerFine) return;

    let frame = 0;
    const measure = () => {
      frame = 0;
      const middle = window.innerHeight / 2;
      let best: { slug: ProductAccent; distance: number } | null = null;

      for (const element of root.querySelectorAll(`[${SLUG_ATTRIBUTE}]`)) {
        const value = element.getAttribute(SLUG_ATTRIBUTE);
        if (typeof value !== 'string' || !isProductAccent(value)) continue;
        const box = element.getBoundingClientRect();
        // Off-screen entries are skipped so scrolling past the section returns
        // the page to its own accent instead of holding the last card's.
        if (box.bottom < 0 || box.top > window.innerHeight) continue;
        const distance = Math.abs(box.top + box.height / 2 - middle);
        if (best === null || distance < best.distance) best = { slug: value, distance };
      }

      setSlug(best?.slug ?? null);
    };

    // Coalesced into one frame: a scroll handler that measures on every event
    // is the classic way to make a phone stutter.
    const onScroll = () => {
      if (frame === 0) frame = window.requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      if (frame !== 0) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [isPointerFine]);

  return (
    <div
      ref={rootRef}
      className={className}
      style={slug === null ? resetAccentGlowStyle() : accentGlowStyle(slug)}
    >
      {children}
    </div>
  );
}
