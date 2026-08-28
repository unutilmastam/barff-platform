'use client';

import { useTranslations } from 'next-intl';

/**
 * Keyboard bypass for the header navigation.
 *
 * Visually hidden until focused. Without it a keyboard or screen-reader user
 * tabs through every navigation link on every page before reaching the content
 * — one of the checks a Lighthouse accessibility pass looks for, and one of the
 * few that genuinely changes whether the site is usable.
 */
export function SkipLink() {
  const t = useTranslations('common');

  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-content-inverse"
    >
      {t('skipToContent')}
    </a>
  );
}
