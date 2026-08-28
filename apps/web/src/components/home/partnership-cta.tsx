import { getTranslations } from 'next-intl/server';
import { Container } from '@/components/layout/container';
import { Link } from '@/i18n/navigation';

/**
 * B2B partnership call to action (§4.7).
 *
 * The form itself is S14. Until it exists this points at the product
 * catalogue rather than at a route that would 404 — a dead call to action is
 * worse than a modest one.
 */
export async function PartnershipCta() {
  const t = await getTranslations('home');

  return (
    <Container as="section" className="py-sectionSm sm:py-section">
      <div className="relative overflow-hidden rounded-lg border border-border-brand bg-accent-soft p-8 sm:p-12">
        <div className="max-w-2xl">
          <h2 className="text-2xl font-bold tracking-tight text-content-primary sm:text-3xl">
            {t('partnership.heading')}
          </h2>
          <p className="mt-4 text-content-secondary">{t('partnership.body')}</p>
          <Link
            href="/products"
            className="mt-8 inline-block rounded bg-accent px-5 py-2.5 font-semibold text-content-inverse transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {t('partnership.cta')}
          </Link>
        </div>
      </div>
    </Container>
  );
}
