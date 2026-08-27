import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Container } from '@/components/layout/container';

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('home');

  return (
    <Container as="section" className="py-sectionSm sm:py-section">
      {/* Exactly one h1 per page. The hero composition, statistics and product
          carousel land in S12; this is the shell those sections mount into. */}
      <h1 className="text-4xl font-bold tracking-tight text-content-primary sm:text-5xl lg:text-6xl">
        {t('title')}
      </h1>
      <p className="mt-4 text-lg text-content-secondary sm:text-xl">{t('tagline')}</p>

      <div className="mt-10 max-w-2xl rounded-lg border border-border bg-surface-glass p-6 backdrop-blur-[16px]">
        <p className="text-content-secondary">{t('shellNotice')}</p>
      </div>
    </Container>
  );
}
