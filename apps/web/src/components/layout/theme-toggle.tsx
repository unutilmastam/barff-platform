'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  applyThemeChoice,
  nextThemeChoice,
  readStoredTheme,
  storeTheme,
  type ThemeChoice,
} from '@/lib/theme';

/** Symbols, not words: they carry no language and need no translation (§18). */
const GLYPH: Record<ThemeChoice, string> = {
  system: '◐',
  light: '☀',
  dark: '☾',
};

/**
 * Cycles system → light → dark → system (§16a).
 *
 * The state starts at `system` on both server and client and is corrected in an
 * effect. That order matters: reading `localStorage` during render would differ from the
 * server's HTML on the client's first pass and produce a hydration mismatch.
 * The *palette* does not wait for this — the inline script in the document head
 * has already applied the stored choice before anything paints; only this
 * button's own label catches up.
 */
export function ThemeToggle() {
  const t = useTranslations('theme');
  const [choice, setChoice] = useState<ThemeChoice>('system');

  useEffect(() => {
    setChoice(readStoredTheme(window.localStorage));
  }, []);

  const cycle = () => {
    const next = nextThemeChoice(choice);
    setChoice(next);
    storeTheme(next, window.localStorage);
    applyThemeChoice(next, document.documentElement);
  };

  return (
    <button
      type="button"
      onClick={cycle}
      // The current mode is named in the label rather than only shown as an
      // icon, so the control is usable without seeing it.
      aria-label={t('change', { current: t(choice) })}
      // 24px minimum target (WCAG 2.2 SC 2.5.8) — the same rule the footer
      // links needed in S06.
      className="flex h-9 w-9 items-center justify-center rounded text-content-secondary transition-colors hover:text-content-primary"
    >
      <span aria-hidden="true" className="text-base leading-none">
        {GLYPH[choice]}
      </span>
    </button>
  );
}
