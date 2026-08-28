import { type PublicPageSection } from '@barff/types';
import { Container } from '@/components/layout/container';
import { text } from '@/lib/localized';

interface StatItem {
  value: string;
  label: Record<string, string>;
}

/**
 * Company statistics (§4.2) — **only verified facts**.
 *
 * Renders nothing at all until the CMS carries the numbers. `CLAUDE.md` §1 and
 * §19 forbid inventing production capacity, employee counts or export
 * countries, and BARFF has not supplied any of them (Q-001).
 *
 * Omitting the band is deliberate rather than lazy: a homepage showing
 * "1000+ MOCK" is worse than one with no statistics, because a screenshot of it
 * outlives the placeholder. The section renders the moment an editor fills it
 * in, with no code change.
 */
export function Statistics({
  locale,
  section,
}: {
  locale: string;
  section: PublicPageSection | undefined;
}) {
  const items = readStats(section?.data);
  if (items.length === 0) return null;

  return (
    <Container as="section" className="py-sectionSm">
      <dl className="grid grid-cols-2 gap-6 sm:grid-cols-4">
        {items.map((item) => (
          <div key={item.value} className="border-l border-border-strong pl-4">
            <dt className="text-sm text-content-muted">{text(item.label, locale)}</dt>
            <dd className="mt-1 text-3xl font-bold text-content-primary sm:text-4xl">
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
    </Container>
  );
}

/**
 * The `data` column is unvalidated JSON by design (D-010), so it is narrowed
 * here rather than trusted. Anything malformed yields no statistics, which is
 * the same safe outcome as an empty section.
 */
function readStats(data: unknown): StatItem[] {
  if (typeof data !== 'object' || data === null) return [];
  const items = (data as { items?: unknown }).items;
  if (!Array.isArray(items)) return [];

  return items.filter(
    (item): item is StatItem =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as StatItem).value === 'string' &&
      typeof (item as StatItem).label === 'object',
  );
}
