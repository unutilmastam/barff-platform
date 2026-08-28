import { type ReactNode } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider, hasLocale } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { QueryProvider } from '@/lib/query-provider';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { SkipLink } from '@/components/layout/skip-link';
import { THEME_INIT_SCRIPT } from '@/lib/theme';

/** Renders all three locales at build time rather than on first request. */
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'home' });

  // Full SEO — canonical, hreflang, Open Graph, structured data — is S15.
  // Title and description exist now so no page ships without them.
  return {
    title: { default: t('title'), template: `%s — ${t('title')}` },
    description: t('tagline'),
    // ⚠ REPLACE_WITH_REAL_DATA: no verified company description exists yet
    // (docs/OPEN-QUESTIONS.md → Q-001). Nothing here states a fact about BARFF.
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Required for static rendering: without it every page opts into dynamic
  // rendering the moment it reads a translation.
  setRequestLocale(locale);

  return (
    // `suppressHydrationWarning` because the script below sets `data-theme` on
    // this element before React hydrates. Without it React reports a mismatch
    // it cannot do anything about — the whole point is that the attribute
    // arrives ahead of hydration.
    <html lang={locale} className="h-full" suppressHydrationWarning>
      <head>
        {/* Applies the stored theme before first paint. A visitor who chose
            light must not see a flash of the dark palette on every navigation. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      {/* min-h-full + flex column keeps the footer at the bottom on a short
          page without absolute positioning. */}
      <body className="flex min-h-full flex-col bg-surface-base font-sans antialiased">
        <NextIntlClientProvider>
          <QueryProvider>
            <SkipLink />
            <Header />
            {/* tabIndex={-1} lets the skip link move focus here; without it the
                jump changes the scroll position but not the focus, and a
                screen reader carries on from the header. */}
            <main id="main-content" tabIndex={-1} className="flex-1 outline-none">
              {children}
            </main>
            <Footer />
          </QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
