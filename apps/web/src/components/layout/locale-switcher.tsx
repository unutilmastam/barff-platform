'use client';

import { useTransition } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { LOCALES, type Locale } from '@barff/types';
import { usePathname, useRouter } from '@/i18n/navigation';

const LOCALE_LABEL: Record<Locale, string> = {
  uz: "O'zbekcha",
  ru: 'Русский',
  en: 'English',
};

/**
 * Language switcher.
 *
 * Switching preserves the current route — the DoD for S15 requires it, and
 * dropping a visitor back to the home page whenever they change language is
 * the usual bug. `usePathname` from `@/i18n/navigation` returns the path
 * *without* the locale prefix, which is what makes that possible.
 *
 * Rendered as links rather than a `<select>`: each language is a real URL that
 * a crawler can follow and a visitor can bookmark (§19 hreflang).
 */
export function LocaleSwitcher() {
  const t = useTranslations('common');
  const activeLocale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <nav aria-label={t('switchLanguage')} className="flex items-center gap-1">
      {LOCALES.map((locale) => {
        const isActive = locale === activeLocale;
        return (
          <button
            key={locale}
            type="button"
            lang={locale}
            // `aria-current` tells a screen reader which language is active;
            // colour alone would not.
            aria-current={isActive ? 'true' : undefined}
            disabled={isPending}
            onClick={() => {
              startTransition(() => {
                router.replace(pathname, { locale });
              });
            }}
            className={`rounded px-2 py-1 text-sm transition-colors ${
              isActive
                ? 'bg-surface-overlay text-content-primary'
                : 'text-content-muted hover:text-content-primary'
            }`}
          >
            <span className="sr-only">{LOCALE_LABEL[locale]}</span>
            <span aria-hidden="true">{locale.toUpperCase()}</span>
          </button>
        );
      })}
    </nav>
  );
}
