import { type Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { fetchPageSections, listOr, sectionByKey } from '@/lib/content-api';
import { Container } from '@/components/layout/container';
import { CmsSection } from '@/components/home/cms-section';
import { text } from '@/lib/localized';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'company' });
  return { title: t('title'), description: t('intro') };
}

/**
 * `/company` (§4).
 *
 * The page exists and is navigable; its content is the client's. Nothing here
 * asserts a founding year, an employee count or an export market — those are
 * Q-001, and §1 forbids inventing them. The hero and the sections below render
 * as soon as an editor publishes them (Q-026).
 */
export default async function CompanyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('company');

  const sections = listOr(await fetchPageSections('company'));
  const hero = sectionByKey(sections, 'hero');

  return (
    <>
      <Container as="section" className="py-sectionSm sm:py-section">
        <h1 className="text-4xl font-bold tracking-tight text-content-primary sm:text-5xl">
          {text(hero?.heading, locale) || t('title')}
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-content-secondary">
          {text(hero?.subheading, locale) || t('intro')}
        </p>
      </Container>

      {sections
        .filter((section) => section.key !== 'hero')
        .map((section) => (
          <CmsSection key={section.key} section={section} locale={locale} />
        ))}
    </>
  );
}
