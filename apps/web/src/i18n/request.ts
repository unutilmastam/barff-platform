import { getRequestConfig } from 'next-intl/server';
import { hasLocale } from 'next-intl';
import { routing } from './routing';

/**
 * Resolves the messages for a request.
 *
 * An unknown locale falls back to the default rather than throwing: a stale
 * bookmark or a crawler hitting `/de` should get the Uzbek page, not a 500.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
    // BARFF operates in one timezone; dates render in Tashkent time regardless
    // of where the visitor is (see @barff/utils/date).
    timeZone: 'Asia/Tashkent',
  };
});
