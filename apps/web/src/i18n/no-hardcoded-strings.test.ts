import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { LOCALES } from '@barff/types';

/**
 * Enforces `CLAUDE.md` §18: user-facing text lives in message files, never in a
 * component.
 *
 * Checked continuously rather than reviewed once. The rule is easy to state and
 * easy to forget under deadline, and a single hard-coded string is invisible
 * until somebody switches language and finds a stray Uzbek word on the Russian
 * page. S15 can extend this into a lint rule; the point is that it fails a test
 * run today.
 */
const SRC = fileURLToPath(new URL('..', import.meta.url));

/**
 * Text that is not translatable copy.
 *
 * `BARFF` is a brand name — the same in all three languages. Digits and
 * symbols carry no language. Keep this list short: every entry is a hole.
 */
const ALLOWED = new Set(['BARFF', '404', '✕', '≡', '©', ':', '—', '.', ',']);

function collectTsxFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'messages' || entry === 'node_modules') continue;
      collectTsxFiles(full, found);
    } else if (entry.endsWith('.tsx')) {
      found.push(full);
    }
  }
  return found;
}

/**
 * JSX text nodes: the content between a `>` and the next `<`.
 *
 * Newlines are deliberately inside the character class. Excluding them missed
 * every multi-line element — which is most of them, since Prettier puts the
 * text of a long `<Link>` on its own line. The first version of this check
 * passed against a deliberately planted string for exactly that reason.
 */
function extractJsxText(source: string): string[] {
  const matches = source.matchAll(/>([^<>{}]+)</g);
  return [...matches].map((match) => (match[1] ?? '').trim()).filter((text) => text.length > 0);
}

/** Literals in props a screen reader or the user actually reads. */
function extractUserFacingProps(source: string): string[] {
  const matches = source.matchAll(
    /(?:aria-label|title|placeholder|alt|aria-description)=(?:"([^"]+)"|'([^']+)')/g,
  );
  return [...matches].map((match) => match[1] ?? match[2] ?? '').filter(Boolean);
}

function isSuspicious(text: string): boolean {
  if (ALLOWED.has(text)) return false;
  // Two or more consecutive letters reads as a word rather than punctuation or
  // a symbol.
  return /\p{L}{2,}/u.test(text);
}

describe('no hard-coded user-facing strings', () => {
  const files = collectTsxFiles(SRC);

  it('finds components to check', () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it.each(files.map((file) => [file.replace(SRC, ''), file]))(
    '%s uses translation keys',
    (_name, file) => {
      const source = readFileSync(file, 'utf8');

      // The global not-found renders outside any locale segment, so there is no
      // message catalogue to read from. It is deliberately minimal and is the
      // one documented exception.
      if (file.endsWith(join('app', 'not-found.tsx'))) return;

      const offenders = [...extractJsxText(source), ...extractUserFacingProps(source)].filter(
        isSuspicious,
      );

      expect(offenders, `hard-coded text in ${file}: ${offenders.join(' | ')}`).toEqual([]);
    },
  );
});

describe('message catalogues', () => {
  const catalogues = LOCALES.map((locale) => ({
    locale,
    messages: JSON.parse(
      readFileSync(join(SRC, 'i18n', 'messages', `${locale}.json`), 'utf8'),
    ) as Record<string, Record<string, string>>,
  }));

  function flatten(messages: Record<string, Record<string, string>>): string[] {
    return Object.entries(messages)
      .flatMap(([namespace, entries]) => Object.keys(entries).map((key) => `${namespace}.${key}`))
      .sort();
  }

  it('exists for every supported locale', () => {
    expect(catalogues).toHaveLength(LOCALES.length);
  });

  it('has identical keys in every language', () => {
    // A key present in uz but missing in ru renders the raw key on the page —
    // and only on the Russian version, which is exactly where nobody looks.
    const [reference, ...rest] = catalogues;
    const referenceKeys = flatten(reference!.messages);
    for (const catalogue of rest) {
      expect(
        flatten(catalogue.messages),
        `${catalogue.locale} differs from ${reference!.locale}`,
      ).toEqual(referenceKeys);
    }
  });

  it('has no empty translations', () => {
    for (const { locale, messages } of catalogues) {
      for (const [namespace, entries] of Object.entries(messages)) {
        for (const [key, value] of Object.entries(entries)) {
          expect(value.trim(), `${locale}: ${namespace}.${key} is empty`).not.toBe('');
        }
      }
    }
  });
});
