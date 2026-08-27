/**
 * Slug generation for products, news and gallery items.
 *
 * Product names arrive in Uzbek Latin, Uzbek Cyrillic and Russian, so a plain
 * `normalize('NFKD')` is not enough — Cyrillic has no Latin decomposition and
 * would be stripped entirely, turning `Гранатовый сок` into an empty slug.
 */

/**
 * Cyrillic → Latin map covering Russian and Uzbek Cyrillic.
 *
 * Uzbek Cyrillic specifics: `ў → o'`, `ғ → g'`, `қ → q`, `ҳ → h`. The
 * apostrophes are dropped later by the character filter, which matches how the
 * existing product slugs are written (`qulupnay-ananas`, not `qulupnay-ananas'`).
 */
const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  ғ: 'g',
  д: 'd',
  е: 'e',
  ё: 'yo',
  ж: 'j',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  қ: 'q',
  л: 'l',
  м: 'm',
  н: 'n',
  ң: 'ng',
  о: 'o',
  ў: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ҳ: 'h',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'shch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
};

function transliterate(input: string): string {
  let result = '';
  for (const char of input) {
    const lower = char.toLowerCase();
    const mapped = CYRILLIC_TO_LATIN[lower];
    result += mapped === undefined ? char : mapped;
  }
  return result;
}

export interface SlugifyOptions {
  /** Character placed between words. Defaults to `-`. */
  separator?: string;
  /** Truncate the result to this many characters, without cutting mid-word. */
  maxLength?: number;
}

/**
 * Converts arbitrary text into a URL-safe slug.
 *
 * Returns an empty string when the input contains nothing slug-worthy; callers
 * that require a slug (product create, news create) must validate the result
 * rather than assume success.
 */
export function slugify(input: string, options: SlugifyOptions = {}): string {
  const separator = options.separator ?? '-';

  const slug = transliterate(input)
    .normalize('NFKD')
    // Strip combining marks left by NFKD (é → e).
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    // Uzbek Latin uses ʻ and ' as letter modifiers (o', g'); drop them so
    // `Qo'shimcha` and `Qoshimcha` produce the same slug.
    .replace(/['‘’ʻʼ`]/g, '')
    .replace(/[^a-z0-9]+/g, separator)
    .replace(new RegExp(`\\${separator}{2,}`, 'g'), separator)
    .replace(new RegExp(`^\\${separator}|\\${separator}$`, 'g'), '');

  if (options.maxLength === undefined || slug.length <= options.maxLength) {
    return slug;
  }

  const truncated = slug.slice(0, options.maxLength);
  const lastSeparator = truncated.lastIndexOf(separator);
  // Prefer a clean word boundary, but never return a stub shorter than half
  // the requested length.
  return lastSeparator > options.maxLength / 2
    ? truncated.slice(0, lastSeparator)
    : truncated.replace(new RegExp(`\\${separator}$`), '');
}

export function isValidSlug(value: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

/**
 * Appends a numeric suffix until the slug is unique within `taken`.
 *
 * Slug uniqueness is ultimately enforced by a database constraint (S09); this
 * helper only produces the candidate the admin UI suggests.
 */
export function uniqueSlug(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;

  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) {
    suffix += 1;
  }
  return `${base}-${suffix}`;
}
