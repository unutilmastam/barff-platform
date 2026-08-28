/**
 * Content skeleton — production steps and the empty page sections.
 *
 * Unlike `seed-mock-products.ts`, none of this is a placeholder for a BARFF
 * fact, so it is seeded unconditionally and in production too:
 *
 * - The eight production stages and their order are specified in `CLAUDE.md`
 *   §4. They describe the process the site is being built to show, so seeding
 *   them is not inventing anything — and it stops a CMS user from having to
 *   retype them, in order, without a typo.
 * - The page sections are seeded as **drafts with no copy**. They give the CMS
 *   (S19) and the web app (S12) a fixed set of `key`s to agree on, while the
 *   words themselves stay empty until BARFF supplies them (Q-001 in particular:
 *   the homepage statistics are unverified company facts).
 *
 * Idempotent, like the rest of the seed: names are refreshed, but nothing an
 * editor has written or published is overwritten.
 */
import type { PrismaClient } from '../services/api/generated/prisma/index.js';

/**
 * `Xomashyo → Qabul qilish → Saralash → Ishlab chiqarish → Sifat nazorati →
 * Qadoqlash → Ombor → Yetkazib berish` (`CLAUDE.md` §4).
 *
 * The Uzbek names are the specification's own words. Russian and English are
 * translations of those words — not new claims about how the factory runs.
 * Descriptions stay empty: what happens at each stage is a BARFF fact nobody
 * has supplied, and a plausible-sounding sentence would be an invented one.
 */
const PRODUCTION_STEPS: { key: string; name: { uz: string; ru: string; en: string } }[] = [
  { key: 'xomashyo', name: { uz: 'Xomashyo', ru: 'Сырьё', en: 'Raw materials' } },
  { key: 'qabul-qilish', name: { uz: 'Qabul qilish', ru: 'Приёмка', en: 'Intake' } },
  { key: 'saralash', name: { uz: 'Saralash', ru: 'Сортировка', en: 'Sorting' } },
  {
    key: 'ishlab-chiqarish',
    name: { uz: 'Ishlab chiqarish', ru: 'Производство', en: 'Production' },
  },
  {
    key: 'sifat-nazorati',
    name: { uz: 'Sifat nazorati', ru: 'Контроль качества', en: 'Quality control' },
  },
  { key: 'qadoqlash', name: { uz: 'Qadoqlash', ru: 'Упаковка', en: 'Packaging' } },
  { key: 'ombor', name: { uz: 'Ombor', ru: 'Склад', en: 'Warehouse' } },
  {
    key: 'yetkazib-berish',
    name: { uz: 'Yetkazib berish', ru: 'Доставка', en: 'Delivery' },
  },
];

/**
 * The homepage sections of `CLAUDE.md` §4, plus a hero for each landing page.
 *
 * Seeded empty and unpublished. The `key` is the contract between the CMS and
 * the frontend; the content is the client's to write.
 */
const PAGE_SECTIONS: { page: string; key: string; type: string }[] = [
  { page: 'home', key: 'hero', type: 'HERO' },
  { page: 'home', key: 'statistics', type: 'STATS' },
  { page: 'home', key: 'factory', type: 'MEDIA' },
  { page: 'home', key: 'products', type: 'RICH_TEXT' },
  { page: 'home', key: 'process', type: 'RICH_TEXT' },
  { page: 'home', key: 'quality', type: 'RICH_TEXT' },
  { page: 'home', key: 'partnership', type: 'CTA' },
  { page: 'home', key: 'news', type: 'RICH_TEXT' },

  { page: 'company', key: 'hero', type: 'HERO' },
  { page: 'production', key: 'hero', type: 'HERO' },
  { page: 'quality', key: 'hero', type: 'HERO' },
  { page: 'partners', key: 'hero', type: 'HERO' },
];

export async function seedContentSkeleton(
  prisma: PrismaClient,
): Promise<{ steps: number; sections: number }> {
  for (const [index, step] of PRODUCTION_STEPS.entries()) {
    await prisma.productionStep.upsert({
      where: { key: step.key },
      // The name and the position are corrected on every run — they come from
      // the specification. `description`, the photograph and `isActive` are
      // left alone, because those are the editor's.
      update: { name: step.name, displayOrder: index },
      create: { key: step.key, name: step.name, displayOrder: index, isActive: true },
    });
  }

  for (const [index, section] of PAGE_SECTIONS.entries()) {
    await prisma.pageSection.upsert({
      where: { page_key: { page: section.page, key: section.key } },
      // Nothing is updated on re-run. Re-seeding must never blank a section an
      // editor has filled in, and `type` is theirs to change if the design
      // moves on.
      update: {},
      create: {
        page: section.page,
        key: section.key,
        type: section.type as never,
        displayOrder: index,
        isActive: false,
      },
    });
  }

  return { steps: PRODUCTION_STEPS.length, sections: PAGE_SECTIONS.length };
}
