import { getTranslations } from 'next-intl/server';
import { type PublicCertificate } from '@barff/types';
import { Container } from '@/components/layout/container';
import { text } from '@/lib/localized';

/**
 * Quality and certificates (§4.6).
 *
 * Renders only real certificate records. §19 is explicit — never generate a
 * certificate that does not exist — and BARFF has not supplied the scans yet
 * (Q-002, Q-013), so today this section is absent rather than illustrated with
 * a plausible-looking badge.
 */
export async function Quality({
  certificates,
  locale,
}: {
  certificates: PublicCertificate[];
  locale: string;
}) {
  const t = await getTranslations('home');
  if (certificates.length === 0) return null;

  return (
    <Container
      as="section"
      className="py-sectionSm sm:py-section"
      aria-labelledby="quality-heading"
    >
      <h2
        id="quality-heading"
        className="text-2xl font-bold tracking-tight text-content-primary sm:text-3xl"
      >
        {t('quality.heading')}
      </h2>

      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {certificates.map((certificate) => (
          <li
            key={certificate.id}
            className="rounded-lg border border-border bg-surface-raised p-5"
          >
            <h3 className="text-base font-semibold text-content-primary">
              {text(certificate.title, locale)}
            </h3>
            {certificate.issuer !== null && (
              <p className="mt-1 text-sm text-content-muted">{certificate.issuer}</p>
            )}
            {certificate.document?.url && (
              <a
                href={certificate.document.url}
                className="mt-3 inline-block text-sm font-semibold text-accent-text underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                // The scan opens in a new tab; the label says so, because a
                // link that silently replaces the page is disorienting.
                target="_blank"
                rel="noopener noreferrer"
              >
                {t('quality.openDocument')}
              </a>
            )}
          </li>
        ))}
      </ul>
    </Container>
  );
}
