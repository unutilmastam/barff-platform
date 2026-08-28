import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { Container } from '@/components/layout/container';
import { DevUiGallery } from './gallery';

/**
 * Design-system review route.
 *
 * Chosen over Storybook: it renders against the real Tailwind build, the real
 * tokens and the real fonts, so what is reviewed here is what ships. Storybook
 * would add a large dependency tree and its own rendering environment to
 * diverge from.
 *
 * Not served in production. The page is a developer tool, and shipping it
 * publicly would put an unindexed, untranslated page on barff.uz. Set
 * `NEXT_PUBLIC_SHOW_DEV_UI=true` to expose it on staging for design review.
 */
const isEnabled =
  process.env.NODE_ENV !== 'production' || process.env['NEXT_PUBLIC_SHOW_DEV_UI'] === 'true';

export const metadata = {
  title: 'UI',
  // Never indexed, even where it is reachable.
  robots: { index: false, follow: false },
};

export default async function DevUiPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  if (!isEnabled) notFound();

  return (
    <Container className="py-12">
      <DevUiGallery />
    </Container>
  );
}
