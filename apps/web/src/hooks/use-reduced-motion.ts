'use client';

import { useEffect, useState } from 'react';

/**
 * Whether the visitor has asked the OS to reduce motion.
 *
 * `globals.css` already disables CSS animation for these visitors. This hook is
 * for the JavaScript half — the GSAP timelines and the Three.js hero (S16, S17)
 * — which CSS cannot reach.
 *
 * Starts `false` and updates after mount, because the server has no way to know
 * the preference. Callers should therefore treat it as "motion is allowed until
 * proven otherwise" and avoid starting an animation in the same tick as mount.
 */
export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(query.matches);

    const onChange = (event: MediaQueryListEvent) => setPrefersReducedMotion(event.matches);
    // The preference can change while the page is open.
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return prefersReducedMotion;
}
