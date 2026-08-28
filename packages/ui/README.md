# @barff/ui

The BARFF design system — 14 primitives and 5 surfaces, implementing
`CLAUDE.md` §16.

Reviewed at **`/uz/dev/ui`** (`pnpm --filter @barff/web dev`). That route
renders every component against the real theme and real Tailwind build, and is
where the accessibility audits below are run. It is not served in production.

## Two rules this package follows

**No user-facing text lives here.** Every string a person reads — a close
button's label, pagination wording, the "not verified" marker — is a required
prop, passed in already translated. A design system containing English is a
design system the Russian site cannot use (§18). Enforced by
`src/design-constraints.test.ts`.

**Radix for anything interactive.** Dialog, Sheet, Tabs, Accordion, Select,
Checkbox and Toast are built on Radix. Focus traps, focus return, roving
tabindex, Escape handling, listbox typeahead and live regions are where design
systems quietly fail their accessibility promise — they are subtle enough that a
hand-rolled version looks correct and is not. Button, Link, Badge, Input,
Textarea, Skeleton and Pagination are hand-built, because they have no such
behaviour to get wrong.

## Components

| Primitive            | Notes                                                                                                                                                           |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button`             | 4 variants, 4 sizes. Defaults to `type="button"` — an untyped button inside a form submits it. All sizes clear 24px for touch.                                  |
| `Link`               | Underlined by default; colour alone is not a sufficient cue. `external` adds `noopener noreferrer`.                                                             |
| `Badge`              | `srLabel` for badges whose meaning is carried by colour.                                                                                                        |
| `Field`              | Wires label, description and error to the control: `id`, `aria-describedby`, `aria-invalid`. Errors are `role="alert"`, so they are announced when they appear. |
| `Input` / `Textarea` | Read `Field` context automatically.                                                                                                                             |
| `Checkbox`           | Radix — stays a real control in the accessibility tree, supports indeterminate.                                                                                 |
| `Select`             | Radix listbox: typeahead, arrow keys, focus return on close.                                                                                                    |
| `Dialog`             | Focus trapped and returned, Escape closes, page inert, scroll locked. `DialogTitle` is required — without it the dialog has no accessible name.                 |
| `Sheet`              | The same Radix Dialog, positioned at an edge. Not a second implementation — that would mean maintaining two focus traps.                                        |
| `Tabs`               | Roving tabindex; only the active tab is in the tab order.                                                                                                       |
| `Accordion`          | `aria-expanded` / `aria-controls`; collapsed panels leave the accessibility tree.                                                                               |
| `Toast`              | Live region, so it is announced and not merely visible. Stays open while hovered or focused — a message on a timer is unreadable for anyone who reads slowly.   |
| `Skeleton`           | Hidden from assistive tech unless given `srLabel`; announcing "loading" once per block is worse than saying nothing.                                            |
| `Pagination`         | Windowed page list. All labels are props. `buildPageItems` is exported and unit-tested separately.                                                              |

| Surface         | Notes                                                                                                                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GlassCard`     | Translucent, thin border, `rounded-lg`. `backdrop-filter` is expensive — a handful of panels, not a grid of fifty.                                                                               |
| `Section`       | The one vertical rhythm scale, tightened on small screens.                                                                                                                                       |
| `SectionHeader` | Heading level is explicit, so reuse cannot produce a skipped level and a broken document outline.                                                                                                |
| `StatBlock`     | `unverified` visibly and audibly marks a figure BARFF has not confirmed (§1, Q-001). A placeholder that looks like a verified figure is how invented data reaches a live page.                   |
| `MediaFrame`    | Reserves the aspect ratio before the image loads, which is what keeps CLS at zero. Ratios match `ASSETS.md`: square for the 1254×1254 product renders, `wide` for a hero with no text burned in. |

## Verified

- **Lighthouse accessibility 100/100** on `/uz/dev/ui`, zero failing audits.
- **Keyboard**: dialog traps focus and returns it to the trigger on Escape;
  tabs respond to arrows, Home and End with a roving tabindex; accordion
  toggles on Enter; select opens as a listbox and returns focus on selection;
  checkbox toggles on Space; every focusable element shows a ring.
- **Contrast**: every token pair the system renders is asserted against WCAG AA
  in `@barff/config`'s `contrast.test.ts`.

Two defects were found by those audits rather than by review: the danger fill
failed contrast at 3.55:1, and select placeholders used `content.disabled`
(2.72:1) when a placeholder is live text, not a disabled control.

`state.danger` and `state.dangerFill` are deliberately two different values.
Red text on a dark surface must be light; a red fill under white text must be
dark. One value cannot satisfy both, and the compromise fails one of them
silently.

## Consuming it

Ships TypeScript source rather than a bundle — `'use client'` directives do not
survive bundling reliably. Consumers must list `@barff/ui` in
`transpilePackages` **and** point Tailwind at the package:

```css
@source "../../../../packages/ui/src";
```

Without that `@source` line Tailwind generates none of this package's utilities
and every component renders unstyled — while still looking plausible, because
the markup and the app's own classes are unaffected. That is exactly how it was
first shipped here, and it was caught by measuring a button, not by looking at
the page.
