# @barff/web

The public website — `barff.uz`. Next.js App Router, React 19, Tailwind v4.

> **Current state:** step **S06 — web shell**. Layout, i18n routing, theme
> tokens, data-fetching plumbing and the loading/error/not-found states exist.
> There is no page content yet: `/` is filled in by S12 and the remaining routes
> by S13.

```bash
pnpm --filter @barff/web dev     # http://localhost:3000 → /uz
```

## Routing and i18n

`/` redirects to the visitor's language, defaulting to `uz`. Every page lives
under a locale prefix — `/uz`, `/ru`, `/en`.

`localePrefix: 'always'`, so the default locale is served from `/uz` rather than
from `/`. An unprefixed default would give the same content two URLs, which
costs the site its canonical (§19) and makes the language switcher ambiguous.

Locales and the default come from `@barff/types`, so the site, the API and the
CMS cannot disagree about which languages exist.

**No user-facing string is written in a component** (§18). Text lives in
`src/i18n/messages/{uz,ru,en}.json` and is read with `useTranslations`. This is
enforced by `src/i18n/no-hardcoded-strings.test.ts`, which also asserts that all
three catalogues have identical keys — a key present in `uz` but missing in `ru`
renders the raw key, and only on the page nobody checks.

Import `Link` from `@/i18n/navigation`, never from `next/link`: the former keeps
the active locale in the href, so a link cannot silently drop a visitor from
`/ru` back to `/uz`.

## Theme (§16a)

Tailwind v4 loads `tailwind.config.ts` via `@config` in `globals.css`, and that
config spreads the preset from `@barff/config`. The tokens are TypeScript so one
definition serves Tailwind and any future consumer.

**Dark and light are both first-class.** Themed values reach CSS as custom
properties (`packages/config/theme.css`, imported at the top of `globals.css`)
rather than as literals. That is the whole mechanism: before S07a, Tailwind
compiled `.bg-surface-base{background-color:#08090b}`, and there was no runtime
value for a toggle or a media query to change.

The toggle in the header cycles **system → light → dark**. Three states, not
two: `system` has to remain reachable, or a visitor who once tapped the control
can never go back to following their OS. Choosing `system` _removes_ the
`data-theme` attribute rather than resolving it, so changing the OS setting with
the tab open is followed live.

`THEME_INIT_SCRIPT` runs inline in `<head>`, before the body is parsed. Without
it, a visitor who chose light gets a flash of the dark palette on every
navigation — worst on a slow connection, where it is least forgivable.

**Never use a raw `brand-*` utility.** The ramp is one value in both themes, so
`bg-brand-500` passes WCAG on dark and fails at 2.6:1 on light — which is what a
Lighthouse run in light mode actually found on `/dev/ui` and the error pages.
Use `accent`, `accent-hover`, `accent-text`, `accent-soft`; a test in this app
and in `packages/ui` fails if the ramp comes back.

### Reactive accent (§17a)

`--barff-accent-glow` is registered with `@property` so it can transition — an
unregistered custom property snaps instead of animating. `accentGlowStyle(slug)`
in `src/lib/product-accent.ts` is what S12 hangs on a bottle; the value
inherits, so one hovered product tints everything beneath it with no re-render.

It drives **glow and highlights only**. Body text, surfaces and borders never
read it, which is what makes §17a's "AA at every point of the transition"
structurally true rather than a claim about animation frames.

> ⚠ The brand green, the font stack and the seven juice accents are
> **placeholders** — `docs/OPEN-QUESTIONS.md` → Q-011, Q-028, Q-029.

## Pages and data (§4)

`/`, `/company`, `/products`, `/products/[slug]`. Everything on them comes from
the public API through `src/lib/content-api.ts`.

Two rules that layer holds to:

- **Nothing throws.** A page that cannot reach the API renders its empty state.
  The API is a separate deployment, and a rolling restart of it should degrade
  barff.uz, never take it down.
- **The build does not need a live API.** CI builds with nothing running, so
  `generateStaticParams` returning an empty list is a normal outcome. Unknown
  slugs then render on demand and are cached.

The response shapes live in `@barff/types` (`public-content.ts`) and the API's
mappers are annotated with them, so renaming a field on either side is a
compile error rather than a page quietly rendering `undefined`.

### Sections render only with real data

Statistics, certificates and news are absent until the CMS carries them.
`CLAUDE.md` §1 and §19 forbid inventing production figures or certificates, and
a homepage showing `1000+ MOCK` is worse than a shorter homepage — a screenshot
of it outlives the placeholder. Each section appears the moment an editor fills
it in, with no code change.

### Why there is no `loading.tsx`

A route-level `loading.tsx` opens a Suspense boundary, and Next then streams the
response. Two things break when it does, both verified in a browser rather than
reasoned about:

1. **Soft 404s.** The `200` status line is sent before the page can call
   `notFound()`, so every draft product URL returned `200` with 404 content.
2. **Metadata in the wrong place.** `<meta name="description">` was emitted into
   the `<body>` instead of `<head>` — on every user agent, including the crawler
   path Next reserves for bots. §19 requires a description on every public page.

So the marketing pages have no loading route, and `/products` puts its skeleton
in a `<Suspense>` _inside_ the page, around the grid only. The shell and its
metadata resolve first; just the grid streams.

## Accessibility

Lighthouse accessibility is **100/100** on all three locales, with zero failing
audits. What is deliberate rather than incidental:

- a skip link, so a keyboard user is not tabbed through the whole nav on every
  page;
- `<main tabIndex={-1}>`, so the skip link moves _focus_ and not just scroll —
  without it a screen reader carries on from the header;
- a visible `:focus-visible` ring everywhere, never removed;
- `aria-expanded` / `aria-controls` on the mobile menu, with the panel kept in
  the DOM and hidden so `aria-controls` always points at a real element;
- `aria-current` on the active language, since colour alone does not reach a
  screen reader;
- interactive targets ≥ 24px (WCAG 2.2 SC 2.5.8). Lighthouse does not check
  this; the footer links were 16px tall until a viewport pass caught them.

Motion is disabled globally under `prefers-reduced-motion` in `globals.css`, so
animations added later by GSAP (S16) inherit it. `useReducedMotion` covers the
JavaScript half that CSS cannot reach.

## Data

`src/lib/api-client.ts` maps every failure onto `ApiRequestError`, carrying the
`ApiError` shape the API guarantees — UI code branches on a stable `code`, never
on a translated `message`. Requests time out (a hung request otherwise leaves a
spinner on screen forever) and send credentials, because auth rides in HttpOnly
cookies.

The TanStack Query client is created inside `useState`, not at module scope: a
module-level client is shared across every request the server handles, which
leaks one visitor's cached data into another's response. Mutations never retry
automatically — a retried POST can create a second order. S26 adds idempotency
keys, and retries become safe then.
