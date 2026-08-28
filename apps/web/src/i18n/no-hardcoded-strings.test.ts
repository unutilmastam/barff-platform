import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
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
 * JSX text and user-facing attributes, read with the TypeScript parser.
 *
 * The first version matched `>([^<>{}]+)<` against the raw source, which is
 * wrong in both directions. It missed multi-line elements until that was fixed
 * in S06 — and it reports every arrow function as copy, because `(image) =>
 * image !== primary` contains a `>` followed by text followed by a `<` from the
 * next generic. Four files failed that way the moment S12 added real logic.
 *
 * A parser knows what a JSX text node is. `typescript` is already a dependency
 * here, so this costs nothing but the import.
 */
function extractStrings(source: string, fileName: string): string[] {
  const tree = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TSX,
  );

  const found: string[] = [];

  const visit = (node: ts.Node): void => {
    if (ts.isJsxText(node)) {
      const value = node.text.trim();
      if (value !== '') found.push(value);
    }

    // Props a screen reader or the user actually reads. A literal here is just
    // as untranslated as one in the body.
    if (
      ts.isJsxAttribute(node) &&
      node.initializer !== undefined &&
      ts.isStringLiteral(node.initializer) &&
      USER_FACING_PROPS.has(node.name.getText(tree))
    ) {
      found.push(node.initializer.text);
    }

    ts.forEachChild(node, visit);
  };

  visit(tree);
  return found;
}

const USER_FACING_PROPS = new Set([
  'aria-label',
  'title',
  'placeholder',
  'alt',
  'aria-description',
]);

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

      // The design-system review route is a developer tool that is not served
      // in production. §18 exists so the public site can be localized; this
      // page is not part of the public site.
      if (file.includes(join('dev', 'ui'))) return;

      const offenders = extractStrings(source, file).filter(isSuspicious);

      expect(offenders, `hard-coded text in ${file}: ${offenders.join(' | ')}`).toEqual([]);
    },
  );
});

describe('message catalogues', () => {
  type MessageTree = { [key: string]: string | MessageTree };

  const catalogues = LOCALES.map((locale) => ({
    locale,
    messages: JSON.parse(
      readFileSync(join(SRC, 'i18n', 'messages', `${locale}.json`), 'utf8'),
    ) as MessageTree,
  }));

  /**
   * Every leaf, as a dotted path.
   *
   * Recursive because next-intl namespaces nest — `home.cta.products` is one
   * message. The first version of this helper only walked two levels, so it
   * both missed nested keys when comparing languages and crashed on them when
   * checking for empties.
   */
  function flatten(messages: MessageTree, prefix = ''): string[] {
    return Object.entries(messages)
      .flatMap(([key, value]) => {
        const path = prefix === '' ? key : `${prefix}.${key}`;
        return typeof value === 'string' ? [path] : flatten(value, path);
      })
      .sort();
  }

  function leaves(messages: MessageTree, prefix = ''): [string, string][] {
    return Object.entries(messages).flatMap(([key, value]) => {
      const path = prefix === '' ? key : `${prefix}.${key}`;
      return typeof value === 'string'
        ? ([[path, value]] as [string, string][])
        : leaves(value, path);
    });
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
      for (const [path, value] of leaves(messages)) {
        expect(value.trim(), `${locale}: ${path} is empty`).not.toBe('');
      }
    }
  });

  it('keeps interpolation placeholders identical across languages', () => {
    // `{count}` renamed in one language renders the literal brace on that
    // version only. Same failure shape as a missing key, and just as invisible.
    const placeholders = (value: string) => (value.match(/\{[a-zA-Z0-9_]+\}/g) ?? []).sort();
    const [reference, ...rest] = catalogues;
    const referenceLeaves = new Map(leaves(reference!.messages));

    for (const catalogue of rest) {
      for (const [path, value] of leaves(catalogue.messages)) {
        expect(placeholders(value), `${catalogue.locale}: ${path} placeholders differ`).toEqual(
          placeholders(referenceLeaves.get(path) ?? ''),
        );
      }
    }
  });
});
