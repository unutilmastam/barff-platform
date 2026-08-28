'use client';

import { useEffect, useState } from 'react';

/**
 * True on devices with a precise pointer (`CLAUDE.md` §17b).
 *
 * Pointer-driven effects — parallax, tilt, magnetic buttons, cursor glow, and
 * hover-driven accents — apply only here. On a touch screen `:hover` sticks
 * after a tap, so a hover effect becomes a state the visitor cannot leave.
 *
 * Starts `false` and corrects in an effect: the server has no pointer, and
 * guessing would mean rendering one thing and hydrating another. Every effect
 * that uses this must be additive, so `false` is always a safe first answer.
 */
export function usePointerFine(): boolean {
  const [isFine, setIsFine] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(pointer: fine)');
    setIsFine(query.matches);

    const onChange = (event: MediaQueryListEvent) => setIsFine(event.matches);
    // A hybrid laptop switches between touch and trackpad without a reload.
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return isFine;
}
