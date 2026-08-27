import { defineRouting } from 'next-intl/routing';
import { DEFAULT_LOCALE, LOCALES } from '@barff/types';

/**
 * Locale routing — `CLAUDE.md` §18.
 *
 * The list and the default come from `@barff/types`, so the website, the API
 * and the CMS cannot disagree about which languages exist.
 *
 * `localePrefix: 'always'` means `uz` is served from `/uz`, not from `/`. An
 * unprefixed default would give the same content two URLs, which costs the site
 * its canonical (§19) and makes the language switcher's job ambiguous. `/`
 * redirects to the negotiated locale instead.
 */
export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: 'always',
});
