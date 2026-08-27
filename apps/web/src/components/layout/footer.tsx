import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Container } from './container';

export function Footer() {
  const t = useTranslations('footer');
  const tNav = useTranslations('nav');
  // Rendered on the server, so this is the build/request year rather than the
  // visitor's clock — a device with a wrong date cannot show a wrong copyright.
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-border bg-surface-raised">
      <Container className="flex flex-col gap-4 py-8 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-content-muted">
          © {year} BARFF. {t('rights')}
        </p>

        <nav aria-label={tNav('footer')}>
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            <li>
              <Link
                href="/privacy"
                className="inline-flex min-h-6 items-center py-1 text-sm text-content-muted transition-colors hover:text-content-primary"
              >
                {t('privacy')}
              </Link>
            </li>
            <li>
              <Link
                href="/terms"
                className="inline-flex min-h-6 items-center py-1 text-sm text-content-muted transition-colors hover:text-content-primary"
              >
                {t('terms')}
              </Link>
            </li>
          </ul>
        </nav>
      </Container>
    </footer>
  );
}
