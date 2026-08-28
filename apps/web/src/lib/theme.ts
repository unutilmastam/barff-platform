/**
 * Theme selection (`CLAUDE.md` §16a).
 *
 * Three states, not two. "Respect `prefers-color-scheme`" and "provide a manual
 * toggle that persists" are both requirements, and a two-state toggle can only
 * satisfy the second: once a visitor has touched it there is no way back to
 * following the operating system, which is the state most people actually want.
 */
export const THEME_CHOICES = ['system', 'light', 'dark'] as const;
export type ThemeChoice = (typeof THEME_CHOICES)[number];

export const THEME_STORAGE_KEY = 'barff-theme';
/** The attribute `packages/config/theme.css` keys its palettes off. */
export const THEME_ATTRIBUTE = 'data-theme';

export function isThemeChoice(value: unknown): value is ThemeChoice {
  return typeof value === 'string' && (THEME_CHOICES as readonly string[]).includes(value);
}

/** system → light → dark → system. */
export function nextThemeChoice(current: ThemeChoice): ThemeChoice {
  const index = THEME_CHOICES.indexOf(current);
  return THEME_CHOICES[(index + 1) % THEME_CHOICES.length] ?? 'system';
}

/** The part of an element this module touches. Narrow so tests need no DOM. */
export type ThemeRoot = Pick<Element, 'setAttribute' | 'removeAttribute'>;

/**
 * Writes the choice onto `<html>`.
 *
 * `system` *removes* the attribute rather than resolving it to a value. The
 * stylesheet's `prefers-color-scheme` block then governs, so a visitor who
 * changes their OS setting with the tab open sees it follow — which is exactly
 * what "system" should mean, and what resolving it once at load would break.
 */
export function applyThemeChoice(choice: ThemeChoice, root: ThemeRoot): void {
  if (choice === 'system') {
    root.removeAttribute(THEME_ATTRIBUTE);
  } else {
    root.setAttribute(THEME_ATTRIBUTE, choice);
  }
}

export function readStoredTheme(storage: Pick<Storage, 'getItem'>): ThemeChoice {
  try {
    const stored = storage.getItem(THEME_STORAGE_KEY);
    return isThemeChoice(stored) ? stored : 'system';
  } catch {
    // Private browsing and "block third-party cookies" both make this throw.
    // Losing the preference is a small cost; a page that fails to render is not.
    return 'system';
  }
}

export function storeTheme(choice: ThemeChoice, storage: Pick<Storage, 'setItem'>): void {
  try {
    storage.setItem(THEME_STORAGE_KEY, choice);
  } catch {
    // As above — the toggle still works for this page view.
  }
}

/**
 * Runs before first paint, in `<head>`, ahead of React.
 *
 * Without this the server sends markup with no `data-theme`, the browser paints
 * the default dark palette, and a visitor who chose light gets a flash of the
 * wrong theme on every navigation — worst on a slow connection, which is
 * exactly where it is least forgivable.
 *
 * Deliberately tiny and dependency-free: it is inline in the document, so its
 * cost is paid on every page load, and anything that throws here would leave
 * the page unstyled.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var c=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(c==='light'||c==='dark'){document.documentElement.setAttribute(${JSON.stringify(
  THEME_ATTRIBUTE,
)},c);}}catch(e){}})();`;
