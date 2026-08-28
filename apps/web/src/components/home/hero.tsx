import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Container } from '@/components/layout/container';
import { MediaImage } from '@/components/media/media-image';
import { type PublicPageSection } from '@barff/types';
import { text } from '@/lib/localized';

/**
 * Homepage hero (§4.1).
 *
 * A static composition. The 3D bottle scene is S17, and §26 is explicit that
 * usable content must paint before any heavy visual: the headline and its call
 * to action are server-rendered text, so the LCP element is the h1 — never an
 * effect that has to download and initialise first.
 *
 * Copy comes from the CMS when an editor has written it and from the message
 * files otherwise. Neither states a fact about BARFF (Q-001, Q-026).
 */
export async function Hero({
  locale,
  section,
}: {
  locale: string;
  section: PublicPageSection | undefined;
}) {
  const t = await getTranslations('home');

  const heading = text(section?.heading, locale) || t('title');
  const subheading = text(section?.subheading, locale) || t('tagline');

  return (
    <section className="relative overflow-hidden border-b border-border-subtle">
      {/* Decorative wash. It reads the reactive accent (§17a) so the hero
          responds to the product carousel below, and nothing here carries
          meaning or contrast requirements. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(70% 55% at 50% 0%, var(--barff-accent-soft) 0%, transparent 70%)',
        }}
      />

      <Container className="relative py-sectionSm sm:py-section">
        <div className="max-w-3xl">
          <h1 className="text-4xl font-bold tracking-tight text-content-primary sm:text-5xl lg:text-6xl">
            {heading}
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-content-secondary sm:text-xl">{subheading}</p>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href="/products"
              className="rounded bg-accent px-5 py-2.5 font-semibold text-content-inverse transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {t('cta.products')}
            </Link>
            <Link
              href="/company"
              className="rounded border border-border-strong px-5 py-2.5 font-semibold text-content-primary transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {t('cta.company')}
            </Link>
          </div>
        </div>

        {section?.media && (
          <div className="relative mt-12 aspect-[16/9] w-full overflow-hidden rounded-lg border border-border">
            <MediaImage
              media={section.media}
              alt={heading}
              sizes="(min-width: 1280px) 1200px, 100vw"
              className="object-cover"
            />
          </div>
        )}
      </Container>
    </section>
  );
}
