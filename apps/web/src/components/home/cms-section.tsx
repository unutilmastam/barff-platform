import { type PublicPageSection } from '@barff/types';
import { Container } from '@/components/layout/container';
import { MediaImage } from '@/components/media/media-image';
import { Link } from '@/i18n/navigation';
import { hasText, text } from '@/lib/localized';

/**
 * Renders an editor-authored page section.
 *
 * Returns `null` when the section is missing or still empty, which is the state
 * everything is in today: S10 seeds the sections as unpublished drafts so the
 * CMS and this app agree on a set of keys, while every word stays BARFF's to
 * write (Q-026). A section appears the moment it is filled in and published —
 * no code change, and nothing invented in the meantime.
 */
export function CmsSection({
  section,
  locale,
  headingId,
}: {
  section: PublicPageSection | undefined;
  locale: string;
  headingId?: string;
}) {
  if (section === undefined) return null;

  const heading = text(section.heading, locale);
  const body = text(section.body, locale);
  const hasMedia = section.media !== null;
  if (heading === '' && body === '' && !hasMedia) return null;

  const ctaLabel = text(section.ctaLabel, locale);
  const showCta = section.ctaHref !== null && ctaLabel !== '';

  return (
    <Container
      as="section"
      className="py-sectionSm sm:py-section"
      {...(headingId === undefined ? {} : { 'aria-labelledby': headingId })}
    >
      <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-12">
        <div>
          {heading !== '' && (
            <h2
              {...(headingId === undefined ? {} : { id: headingId })}
              className="text-2xl font-bold tracking-tight text-content-primary sm:text-3xl"
            >
              {heading}
            </h2>
          )}
          {hasText(section.subheading, locale) && (
            <p className="mt-3 text-lg text-content-secondary">
              {text(section.subheading, locale)}
            </p>
          )}
          {body !== '' && <p className="mt-4 text-content-secondary">{body}</p>}
          {showCta && (
            <Link
              href={section.ctaHref ?? '/'}
              className="mt-8 inline-block rounded border border-border-strong px-5 py-2.5 font-semibold text-content-primary transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {ctaLabel}
            </Link>
          )}
        </div>

        {hasMedia && (
          <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-border">
            <MediaImage
              media={section.media}
              alt={heading}
              sizes="(min-width: 1024px) 50vw, 100vw"
              className="object-cover"
            />
          </div>
        )}
      </div>
    </Container>
  );
}
