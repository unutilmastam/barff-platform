'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Container } from './container';
import { LocaleSwitcher } from './locale-switcher';
import { ThemeToggle } from './theme-toggle';

/**
 * Routes from `CLAUDE.md` §4.
 *
 * Only the pages that exist are linked. The rest arrive in S12–S13; linking
 * them now would put dead links in the navigation and in the sitemap.
 */
const NAV_ITEMS = [
  { href: '/', key: 'home' },
  { href: '/products', key: 'products' },
  { href: '/company', key: 'company' },
] as const;

export function Header() {
  const t = useTranslations('nav');
  const tCommon = useTranslations('common');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface-base/80 backdrop-blur-[16px]">
      <Container className="flex h-16 items-center justify-between gap-4">
        <Link
          href="/"
          className="text-xl font-bold tracking-tight text-content-primary"
          aria-label="BARFF"
        >
          BARFF
        </Link>

        <nav aria-label={t('primary')} className="hidden md:block">
          <ul className="flex items-center gap-6">
            {NAV_ITEMS.map((item) => (
              <li key={item.key}>
                <Link
                  href={item.href}
                  className="text-sm text-content-secondary transition-colors hover:text-content-primary"
                >
                  {t(item.key)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <LocaleSwitcher />

          <button
            type="button"
            className="md:hidden rounded p-2 text-content-secondary"
            // The label flips with state so a screen reader announces what the
            // button will do, not what it did.
            aria-label={isMenuOpen ? tCommon('closeMenu') : tCommon('openMenu')}
            aria-expanded={isMenuOpen}
            aria-controls="mobile-menu"
            onClick={() => setIsMenuOpen((open) => !open)}
          >
            <span aria-hidden="true" className="block text-lg leading-none">
              {isMenuOpen ? '✕' : '≡'}
            </span>
          </button>
        </div>
      </Container>

      {/* Kept in the DOM and hidden, rather than unmounted, so `aria-controls`
          always points at a real element. */}
      <div id="mobile-menu" hidden={!isMenuOpen} className="md:hidden">
        <Container as="nav" className="border-t border-border py-4">
          <ul className="flex flex-col gap-3">
            {NAV_ITEMS.map((item) => (
              <li key={item.key}>
                <Link
                  href={item.href}
                  className="block py-1 text-content-secondary"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {t(item.key)}
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </div>
    </header>
  );
}
