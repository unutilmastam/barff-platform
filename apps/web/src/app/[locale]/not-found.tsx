import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { Container } from '@/components/layout/container';

export default function NotFound() {
  const t = useTranslations('notFound');

  return (
    <Container as="section" className="py-sectionSm sm:py-section">
      <p className="text-sm font-semibold text-accent-text">404</p>
      <h1 className="mt-2 text-3xl font-bold text-content-primary sm:text-4xl">{t('title')}</h1>
      <p className="mt-4 max-w-xl text-content-secondary">{t('description')}</p>
      <Link
        href="/"
        className="mt-8 inline-block rounded bg-accent px-5 py-2.5 font-semibold text-content-inverse transition-colors hover:bg-accent-hover"
      >
        {t('backHome')}
      </Link>
    </Container>
  );
}
