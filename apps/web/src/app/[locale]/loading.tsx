import { useTranslations } from 'next-intl';
import { Container } from '@/components/layout/container';

/**
 * Route-level loading state.
 *
 * `role="status"` with `aria-live="polite"` announces the wait to a screen
 * reader; a spinner alone is silent. The skeleton blocks match the real
 * heading and paragraph sizes so the page does not jump when content lands
 * (§26: no layout shift).
 */
export default function Loading() {
  const t = useTranslations('common');

  return (
    <Container as="section" className="py-sectionSm sm:py-section">
      <div role="status" aria-live="polite">
        <span className="sr-only">{t('loading')}</span>
        <div className="h-12 w-2/3 animate-pulse rounded bg-surface-overlay sm:h-16" />
        <div className="mt-4 h-6 w-1/3 animate-pulse rounded bg-surface-overlay" />
        <div className="mt-10 h-32 max-w-2xl animate-pulse rounded-lg bg-surface-overlay" />
      </div>
    </Container>
  );
}
