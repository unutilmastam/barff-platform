/**
 * MOCK product catalogue.
 *
 * Kept in its own file, behind its own flag, because none of it is a BARFF
 * fact that has been confirmed in writing. `CLAUDE.md` §1 allows clearly marked
 * mock data; it does not allow that data to reach barff.uz by accident, and a
 * seed that runs on every deploy would do exactly that. So:
 *
 * - nothing here is seeded unless `SEED_MOCK_PRODUCTS` is set, and
 * - setting it with `NODE_ENV=production` is a hard error, not a warning.
 *
 * What *is* factual comes off the label artwork in `assets/products` and is
 * recorded in ASSETS.md §3: the product names and the volumes. Everything a
 * label's back side would carry — ingredients, nutrition, shelf life, storage,
 * SKU, barcode — stays null, because BARFF has not supplied it (Q-016) and it
 * is legally required to be correct on a published page. Prices are absent
 * entirely: Q-006 is open and S23 owns pricing.
 */
import type { PrismaClient } from '../services/api/generated/prisma/index.js';

/** Marker copy, so nobody mistakes a fixture for approved marketing text. */
const MOCK_COPY = {
  uz: 'MOCK — tavsif BARFF tomonidan tasdiqlanishi kerak (REPLACE_WITH_REAL_DATA).',
  ru: 'MOCK — описание должно быть предоставлено BARFF (REPLACE_WITH_REAL_DATA).',
  en: 'MOCK — description to be supplied by BARFF (REPLACE_WITH_REAL_DATA).',
};

/**
 * The one category the artwork actually supports: they are juices.
 *
 * A deeper taxonomy (still/carbonated, family/single-serve) would be an
 * invented merchandising decision — see Q-016's neighbours in
 * docs/OPEN-QUESTIONS.md.
 */
const CATEGORY = {
  slug: 'sharbatlar',
  name: { uz: 'Sharbatlar', ru: 'Соки', en: 'Juices' },
};

interface MockProduct {
  slug: string;
  name: { uz: string; ru: string; en: string };
  flavor: string;
  volumeMl: number;
  isActive: boolean;
  /** Why a product is held back, when it is. */
  note?: string;
}

/**
 * Names are transliterations of the printed label, not invented product lines.
 *
 * No regulated claim appears anywhere in this file. The labels carry
 * *100% NATURAL*, *QO'SHIMCHA SHAKAR YO'Q* and *KONSERVANT VA BO'YOQLARSIZ*;
 * those are claims a regulator can act on, and Q-021 asks BARFF to confirm them
 * in writing before the website repeats them.
 */
const PRODUCTS: MockProduct[] = [
  {
    slug: 'granat',
    name: { uz: 'Anor sharbati', ru: 'Гранатовый сок', en: 'Pomegranate juice' },
    flavor: 'pomegranate',
    volumeMl: 350,
    isActive: true,
  },
  {
    slug: 'apelsin',
    name: { uz: 'Apelsin sharbati', ru: 'Апельсиновый сок', en: 'Orange juice' },
    flavor: 'orange',
    volumeMl: 350,
    isActive: true,
  },
  {
    slug: 'olcha',
    name: { uz: 'Olcha sharbati', ru: 'Вишнёвый сок', en: 'Cherry juice' },
    flavor: 'cherry',
    volumeMl: 350,
    isActive: true,
  },
  {
    slug: 'shaftoli',
    name: { uz: 'Shaftoli sharbati', ru: 'Персиковый сок', en: 'Peach juice' },
    flavor: 'peach',
    volumeMl: 350,
    isActive: true,
  },
  {
    slug: 'olma',
    name: { uz: 'Olma sharbati', ru: 'Яблочный сок', en: 'Apple juice' },
    flavor: 'apple',
    volumeMl: 350,
    isActive: true,
  },
  {
    slug: 'multifrukt',
    name: { uz: 'Multifrukt sharbati', ru: 'Мультифруктовый сок', en: 'Multifruit juice' },
    flavor: 'multifruit',
    volumeMl: 350,
    isActive: true,
  },
  {
    // Seeded as a draft on purpose. The artwork shows strawberry and pineapple
    // while the printed text reads *Гранатовый сок* (ASSETS.md §5, Q-019), so
    // nobody currently knows what this product is. Publishing a guess would put
    // the wrong name on a real product page.
    slug: 'qulupnay-ananas',
    name: {
      uz: 'Qulupnay-ananas sharbati',
      ru: 'Клубнично-ананасовый сок',
      en: 'Strawberry & pineapple juice',
    },
    flavor: 'strawberry-pineapple',
    volumeMl: 250,
    isActive: false,
    note: 'Q-019: label artwork and printed text disagree — held as a draft.',
  },
];

export function mockProductsRequested(): boolean {
  const value = process.env['SEED_MOCK_PRODUCTS']?.trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes';
}

export async function seedMockProducts(prisma: PrismaClient): Promise<number> {
  if (process.env['NODE_ENV'] === 'production') {
    throw new Error(
      'SEED_MOCK_PRODUCTS is set with NODE_ENV=production. Mock catalogue data must never ' +
        'be written to a production database — see docs/OPEN-QUESTIONS.md Q-016, Q-019, Q-021.',
    );
  }

  const category = await prisma.productCategory.upsert({
    where: { slug: CATEGORY.slug },
    update: { name: CATEGORY.name },
    create: { slug: CATEGORY.slug, name: CATEGORY.name, displayOrder: 0, isActive: true },
  });

  let displayOrder = 0;
  for (const definition of PRODUCTS) {
    const shortDescription =
      definition.note === undefined
        ? MOCK_COPY
        : { ...MOCK_COPY, en: `${MOCK_COPY.en} ${definition.note}` };

    const product = await prisma.product.upsert({
      where: { slug: definition.slug },
      // `isActive` is deliberately not updated on re-run: an editor who
      // published or unpublished a row should not have that undone by a deploy.
      update: {
        name: definition.name,
        shortDescription,
        flavor: definition.flavor,
        categoryId: category.id,
        displayOrder,
      },
      create: {
        slug: definition.slug,
        name: definition.name,
        shortDescription,
        flavor: definition.flavor,
        categoryId: category.id,
        displayOrder,
        isActive: definition.isActive,
        publishedAt: definition.isActive ? new Date() : null,
      },
    });

    // Variants have no natural key until BARFF supplies SKUs (Q-016), so the
    // volume identifies one within its product.
    const existing = await prisma.productVariant.findFirst({
      where: { productId: product.id, volumeMl: definition.volumeMl },
    });
    if (existing === null) {
      await prisma.productVariant.create({
        data: { productId: product.id, volumeMl: definition.volumeMl, displayOrder: 0 },
      });
    }

    displayOrder += 1;
  }

  return PRODUCTS.length;
}
