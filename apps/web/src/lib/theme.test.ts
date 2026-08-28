import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  applyThemeChoice,
  isThemeChoice,
  nextThemeChoice,
  readStoredTheme,
  storeTheme,
  THEME_ATTRIBUTE,
  THEME_INIT_SCRIPT,
  THEME_STORAGE_KEY,
} from './theme';
import { accentGlowStyle, isProductAccent, resetAccentGlowStyle } from './product-accent';

describe('theme choice', () => {
  it('cycles through all three states and back', () => {
    // Two states would strand anyone who touched the toggle: there would be no
    // way back to following the operating system, which §16a requires the site
    // to respect.
    expect(nextThemeChoice('system')).toBe('light');
    expect(nextThemeChoice('light')).toBe('dark');
    expect(nextThemeChoice('dark')).toBe('system');
  });

  it('rejects anything that is not a theme', () => {
    expect(isThemeChoice('dark')).toBe(true);
    expect(isThemeChoice('DARK')).toBe(false);
    expect(isThemeChoice(null)).toBe(false);
  });
});

describe('applyThemeChoice', () => {
  const fakeRoot = () => {
    const attributes = new Map<string, string>();
    return {
      attributes,
      setAttribute: (name: string, value: string) => void attributes.set(name, value),
      removeAttribute: (name: string) => void attributes.delete(name),
    };
  };

  it('sets the attribute for an explicit choice', () => {
    const root = fakeRoot();
    applyThemeChoice('light', root);
    expect(root.attributes.get(THEME_ATTRIBUTE)).toBe('light');
  });

  it('removes the attribute for system, rather than resolving it', () => {
    // Resolving `system` to a value once at load would freeze the page at
    // whatever the OS said then. Removing the attribute hands the decision back
    // to the stylesheet's media query, so changing the OS setting with the tab
    // open is followed live.
    const root = fakeRoot();
    applyThemeChoice('dark', root);
    applyThemeChoice('system', root);
    expect(root.attributes.has(THEME_ATTRIBUTE)).toBe(false);
  });
});

describe('storage', () => {
  it('round-trips a choice', () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    };

    storeTheme('dark', storage);
    expect(store.get(THEME_STORAGE_KEY)).toBe('dark');
    expect(readStoredTheme(storage)).toBe('dark');
  });

  it('falls back to system when storage throws', () => {
    // Private browsing and blocked site data both make localStorage throw. A
    // page that fails to render because it could not read a preference is a
    // much worse outcome than losing the preference.
    const throwing = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    };

    expect(readStoredTheme(throwing)).toBe('system');
    expect(() => storeTheme('light', throwing)).not.toThrow();
  });

  it('ignores a corrupt stored value', () => {
    expect(readStoredTheme({ getItem: () => 'neon' })).toBe('system');
  });
});

describe('THEME_INIT_SCRIPT', () => {
  /**
   * Runs the inline script with `document` and `localStorage` shadowed by
   * parameters, so the real behaviour is exercised without a DOM.
   */
  const run = (stored: string | null) => {
    const attributes = new Map<string, string>();
    const documentStub = {
      documentElement: {
        setAttribute: (name: string, value: string) => void attributes.set(name, value),
      },
    };
    const storageStub = { getItem: () => stored };
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
    new Function('document', 'localStorage', THEME_INIT_SCRIPT)(documentStub, storageStub);
    return attributes;
  };

  it('applies a stored choice to the document element', () => {
    expect(run('light').get(THEME_ATTRIBUTE)).toBe('light');
    expect(run('dark').get(THEME_ATTRIBUTE)).toBe('dark');
  });

  it('leaves the attribute alone when nothing is stored', () => {
    // No attribute means the media query decides — the correct behaviour for a
    // visitor who has never touched the toggle.
    expect(run(null).has(THEME_ATTRIBUTE)).toBe(false);
  });

  it('ignores a corrupt stored value instead of applying it', () => {
    expect(run('neon').has(THEME_ATTRIBUTE)).toBe(false);
  });

  it('survives storage that throws', () => {
    const throwingStorage = {
      getItem: () => {
        throw new Error('denied');
      },
    };
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
      new Function('document', 'localStorage', THEME_INIT_SCRIPT)(
        { documentElement: { setAttribute: () => undefined } },
        throwingStorage,
      );
    }).not.toThrow();
  });

  it('is a single self-contained statement, safe to inline', () => {
    expect(THEME_INIT_SCRIPT).toContain('try');
    expect(THEME_INIT_SCRIPT).toContain('catch');
    expect(THEME_INIT_SCRIPT).not.toContain('\n');
  });
});

describe('product accent (§17a)', () => {
  it('points the glow variable at the product variable', () => {
    expect(accentGlowStyle('granat')).toEqual({
      '--barff-accent-glow': 'var(--barff-accent-product-granat)',
    });
  });

  it('resets to the theme accent, which touch devices need', () => {
    expect(resetAccentGlowStyle()).toEqual({ '--barff-accent-glow': 'var(--barff-accent)' });
  });

  it('recognises exactly the seven juices', () => {
    expect(isProductAccent('qulupnay-ananas')).toBe(true);
    expect(isProductAccent('mango')).toBe(false);
  });
});

/**
 * The same §16a guard `packages/ui` carries, for the app's own components.
 *
 * The raw `brand-*` ramp is one value in both themes, so a fill or a focus ring
 * built from it passes WCAG on dark and fails on light — which is precisely
 * what a Lighthouse run in light mode found on `/dev/ui` and the error and
 * not-found pages. The semantic accent tokens carry a value per theme.
 */
describe('§16a theme-independent colours', () => {
  const SRC = fileURLToPath(new URL('..', import.meta.url));

  const collect = (dir: string, found: string[] = []): string[] => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) collect(full, found);
      else if (entry.endsWith('.tsx')) found.push(full);
    }
    return found;
  };

  it('uses no raw brand-ramp utility', () => {
    const offenders = collect(SRC)
      .filter((file) =>
        /\b(?:bg|text|border|outline|from|to|via)-brand-\d/.test(readFileSync(file, 'utf8')),
      )
      .map((file) => file.slice(SRC.length));

    expect(offenders).toEqual([]);
  });
});
