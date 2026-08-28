import { getTranslations } from 'next-intl/server';
import { type PublicNewsArticle } from '@barff/types';
import { Container } from '@/components/layout/container';
import { MediaImage } from '@/components/media/media-image';
import { text } from '@/lib/localized';

/**
 * Latest news (§4.8).
 *
 * `/news` and `/news/[slug]` are S13, so the cards do not link anywhere yet —
 * a link to a route that does not exist is a 404 in the navigation and in the
 * sitemap. The section is absent entirely until something is published.
 */
export async function NewsPreview({
  articles,
  locale,
}: {
  articles: PublicNewsArticle[];
  locale: string;
}) {
  const t = await getTranslations('home');
  if (articles.length === 0) return null;

  return (
    <Container as="section" className="py-sectionSm sm:py-section" aria-labelledby="news-heading">
      <h2
        id="news-heading"
        className="text-2xl font-bold tracking-tight text-content-primary sm:text-3xl"
      >
        {t('news.heading')}
      </h2>

      <ul className="mt-8 grid gap-6 sm:grid-cols-3">
        {articles.map((article) => (
          <li key={article.slug} className="flex flex-col">
            <div className="relative aspect-[16/9] w-full overflow-hidden rounded border border-border">
              <MediaImage
                media={article.coverImage}
                alt={text(article.title, locale)}
                sizes="(min-width: 640px) 33vw, 100vw"
                className="object-cover"
              />
            </div>
            {article.publishedAt !== null && (
              <time
                dateTime={article.publishedAt}
                className="mt-3 text-xs uppercase tracking-wide text-content-muted"
              >
                {new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
                  new Date(article.publishedAt),
                )}
              </time>
            )}
            <h3 className="mt-1 text-base font-semibold text-content-primary">
              {text(article.title, locale)}
            </h3>
          </li>
        ))}
      </ul>
    </Container>
  );
}
