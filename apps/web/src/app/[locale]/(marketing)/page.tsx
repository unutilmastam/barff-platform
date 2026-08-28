import { setRequestLocale } from 'next-intl/server';
import {
  fetchCertificates,
  fetchNews,
  fetchPageSections,
  fetchProducts,
  fetchProductionSteps,
  itemsOr,
  listOr,
  sectionByKey,
} from '@/lib/content-api';
import { Hero } from '@/components/home/hero';
import { Statistics } from '@/components/home/statistics';
import { CmsSection } from '@/components/home/cms-section';
import { ProductCarousel } from '@/components/home/product-carousel';
import { ProductionProcess } from '@/components/home/production-process';
import { Quality } from '@/components/home/quality';
import { PartnershipCta } from '@/components/home/partnership-cta';
import { NewsPreview } from '@/components/home/news-preview';

/**
 * Homepage — the nine sections of `CLAUDE.md` §4.
 *
 * Every request is fetched in parallel: run in sequence, the page would wait
 * for five round trips before rendering anything, and each one is independent.
 *
 * Sections that have no data render nothing. That is the design, not a gap —
 * statistics, certificates and news all describe facts BARFF has not supplied,
 * and a homepage carrying invented ones is worse than a shorter homepage
 * (§1, §19).
 */
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const [sections, products, steps, certificates, news] = await Promise.all([
    fetchPageSections('home'),
    fetchProducts({ pageSize: 8 }),
    fetchProductionSteps(),
    fetchCertificates(),
    fetchNews(3),
  ]);

  const homeSections = listOr(sections);

  return (
    <>
      <Hero locale={locale} section={sectionByKey(homeSections, 'hero')} />
      <Statistics locale={locale} section={sectionByKey(homeSections, 'statistics')} />
      <CmsSection
        locale={locale}
        section={sectionByKey(homeSections, 'factory')}
        headingId="factory-heading"
      />
      <ProductCarousel products={itemsOr(products)} locale={locale} />
      <ProductionProcess steps={listOr(steps)} locale={locale} />
      <Quality certificates={listOr(certificates)} locale={locale} />
      <PartnershipCta />
      <NewsPreview articles={itemsOr(news)} locale={locale} />
    </>
  );
}
