import { getTranslations } from 'next-intl/server';
import { type PublicProductionStep } from '@barff/types';
import { Container } from '@/components/layout/container';
import { text } from '@/lib/localized';

/**
 * The production process (§4.5).
 *
 * An ordered list, because the order is the content: these are eight stages
 * that happen in sequence, and a screen reader should hear "3 of 8" rather than
 * eight unrelated headings. The numbers are `aria-hidden` so they are not read
 * twice.
 *
 * Descriptions are empty until BARFF supplies them (Q-027); the stage names
 * come from `CLAUDE.md` §4 and are seeded, so this renders correctly today.
 */
export async function ProductionProcess({
  steps,
  locale,
}: {
  steps: PublicProductionStep[];
  locale: string;
}) {
  const t = await getTranslations('home');
  if (steps.length === 0) return null;

  return (
    <Container
      as="section"
      className="py-sectionSm sm:py-section"
      aria-labelledby="process-heading"
    >
      <h2
        id="process-heading"
        className="text-2xl font-bold tracking-tight text-content-primary sm:text-3xl"
      >
        {t('process.heading')}
      </h2>

      <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map((step, index) => {
          const description = text(step.description, locale);
          return (
            <li
              key={step.key}
              className="rounded-lg border border-border bg-surface-glass p-4 backdrop-blur-[16px]"
            >
              <span
                aria-hidden="true"
                className="text-sm font-semibold tabular-nums text-accent-text"
              >
                {String(index + 1).padStart(2, '0')}
              </span>
              <h3 className="mt-2 text-base font-semibold text-content-primary">
                {text(step.name, locale)}
              </h3>
              {description !== '' && (
                <p className="mt-2 text-sm text-content-secondary">{description}</p>
              )}
            </li>
          );
        })}
      </ol>
    </Container>
  );
}
