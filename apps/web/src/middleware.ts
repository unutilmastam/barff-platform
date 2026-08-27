import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

/**
 * Locale negotiation and redirect.
 *
 * `/` → `/uz` (or the visitor's matching language). Everything under a locale
 * prefix passes through.
 */
export default createMiddleware(routing);

export const config = {
  // Skip API routes, Next internals and anything with a file extension —
  // running locale negotiation on /favicon.ico would redirect it to
  // /uz/favicon.ico and the asset would 404.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
