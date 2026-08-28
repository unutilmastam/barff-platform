# BARFF.UZ — OPEN QUESTIONS / BLOCKERS

Anything on this page is **not confirmed by BARFF**. Until it is answered, code must use
`MOCK` or `REPLACE_WITH_REAL_DATA` placeholders. Never invent company facts (CLAUDE.md §1).

Status values: `OPEN` · `ASKED` · `ANSWERED` · `BLOCKED`

Format:

```
| ID | Topic | Question | Needed for | Status | Answer |
```

---

## 1. Standing blockers — real data needed from BARFF

Source: `ROADMAP.md` §3.

| ID | Topic | Question | Needed for | Status | Answer |
|---|---|---|---|---|---|
| Q-001 | Company facts | Production capacity, employee count, founding year, export countries | Home statistics, `/company` | OPEN | — |
| Q-002 | Certifications | Which certifications exist, and the real certificate documents | `/quality`, product documents | OPEN | — |
| Q-003 | Legal / contact | Legal address, warehouse addresses, phone numbers, bank details | `/contact`, invoices | OPEN | — |
| Q-004 | Product range | Full product list: names, SKUs, barcodes, volumes, ingredients, nutrition, shelf life | S09 products domain | OPEN | — |
| Q-005 | Media | Product photography and factory photo/video assets | S12, S13, S17 | OPEN | — |
| Q-006 | Commercial policy | Dealer tiers, real price lists, discount and MOQ policy, credit limit policy | S23 pricing engine | OPEN | — |
| Q-007 | Logistics | Delivery regions and logistics rules | S32 delivery domain | OPEN | — |
| Q-008 | Finance / legal | Invoice requirements: numbering, tax fields, signatures | S36 invoices | OPEN | — |
| Q-009 | Accounts | Domains, DNS access, hosting accounts, Telegram bot token, SMS/email provider accounts | S05, S14, S40 | OPEN | — |

## 2. Asset blockers

Source: `ASSETS.md` §4.

| ID | Topic | Question | Needed for | Status | Answer |
|---|---|---|---|---|---|
| Q-010 | Brand | Vector logo (`.svg` / `.ai`) — current logo is raster only and will look soft in the header and is unusable in print | Header, favicon, print, PDF exports | OPEN | — |
| Q-011 | Brand | Brand guideline and the exact BARFF green HEX value | S06 theme tokens, S07 design system | OPEN | — |
| Q-012 | Factory | Factory / production line photos and video | `/production`, home §3, hero | OPEN | — |
| Q-013 | Certificates | HACCP and other certificate scans as PDF | `/quality` | OPEN | — |
| Q-014 | People | Team / director photos | `/company` | OPEN | — |
| Q-015 | Logistics | Warehouse and delivery vehicle photos | `/partners`, delivery pages | OPEN | — |
| Q-016 | Products | Back-label data per product: ingredients, nutrition table, shelf life, storage, SKU, barcode | `/products/[slug]` — legally required if published | OPEN | — |
| Q-017 | Products | Confirmed product range and volumes (500 ml / 1 L — do they exist?) | S09 seed data | OPEN | — |

## 3. Asset quality issues — resolve before production

Source: `ASSETS.md` §5.

| ID | Topic | Question | Needed for | Status | Answer |
|---|---|---|---|---|---|
| Q-018 | `_needs-review/apelsin-500-mockup-FAKE-TEXT.png` | Label text is fabricated (impossible dates "с 2033 года", "2035-vildan buyon"). Does a 500 ml product exist, and can BARFF supply a real photo? **Do not publish this file.** | S09, S12 | OPEN | — |
| Q-019 | `qulupnay-ananas-250-front.png` | Label mismatch: artwork shows strawberry + pineapple, printed text reads *Гранатовый сок*. Which product is this actually? | S09 seed data | OPEN | — |
| Q-020 | `barff-brand-banner.png` | Typo in `QO'SHIMCHA SHAKAR YO"Q` (wrong quote mark). | OG / social image | OPEN | — |
| Q-021 | Product claims | *100% NATURAL*, *QO'SHIMCHA SHAKAR YO'Q*, *KONSERVANT VA BO'YOQLARSIZ* are regulated claims. Confirm in writing before repeating them on the website. | All public copy | OPEN | — |
| Q-022 | Product renders | All bottle renders are 3D/AI mockups — irregular label text becomes visible at full-page or zoom size. Can BARFF supply real studio photography? | `/products/[slug]` | OPEN | — |
| Q-023 | `apelsin-350-real-photo.jpg` | Real photo (960×1280, phone quality) shows a different, darker label design than the render. Which design is currently in production? The site must show what the dealer actually receives. | S09, S12 | OPEN | — |
| Q-024 | Currency precision | Should UZS amounts be stored and invoiced in tiyin (2 decimals, the ISO 4217 definition) or in whole so'm? Tiyin are no longer in circulation. S01 stores the finer unit because rounding up to whole so'm later is safe and recovering lost precision is not. | S23 pricing, S36 invoices | OPEN | — |
| Q-026 | Site copy | The homepage hero, section headings and body copy for `/company`, `/production`, `/quality` and `/partners`. S10 seeds the section structure as empty drafts; every word is BARFF's to supply | S12, S13 | OPEN | — |
| Q-027 | Production process | What actually happens at each of the eight stages. The stage names come from `CLAUDE.md` §4 and are seeded; the descriptions are left empty rather than invented | `/production` | OPEN | — |
| Q-025 | Lead taxonomy | What is the list of business types for the B2B form (distributor, retail chain, HoReCa, …)? Kept as free text in `@barff/validation` until answered — inventing enum values would bake fictional facts into the schema and the database. Pairs with Q-007 (delivery regions). | S14 lead form, S20 pipeline | OPEN | — |

## 4. Decisions to record

Architectural decisions taken because an answer was missing. Revisit when the question is answered.

| ID | Decision | Taken at | Reason |
|---|---|---|---|
| D-001 | MinIO is the local S3-compatible store; the storage provider sits behind an adapter interface | S00 | Keeps local dev off AWS and lets S08 swap providers without touching call sites |
| D-002 | Money is carried as integer minor units (`@barff/utils/money`), never as a float | S01 | S36 requires exact money math; `allocateMoney` distributes remainders so a split always sums back to the original |
| D-003 | `region` and `businessType` on leads are bounded free text, not enums | S01 | The real lists are unknown (Q-007, Q-025); enums would encode invented company facts. Migrating text → enum later is cheap |
| D-004 | Shared enums are `as const` objects with a matching type union, not TS `enum` | S01 | Gives a value and a type from one declaration, survives `isolatedModules`, tree-shakes, and maps cleanly onto Prisma's generated enums |
| D-005 | `@barff/utils` declares its own `Locale` union instead of importing `@barff/types` | S01 | Keeps the lowest layer dependency-free; a test in `@barff/validation` asserts the two stay in sync |
| D-006 | `sku` and `barcode` live on `product_variants`, not on `products` as `CLAUDE.md` §10 lists them | S09 | A SKU identifies a sellable unit: a juice sold in 350 ml and 1 L has two, and the second would have nowhere to go on `products` |
| D-007 | Admin catalogue reads require `products:read_all`, a permission distinct from the `products:read` dealers hold | S09 | The admin listing returns unpublished products; one shared permission would have let every dealer account read the unannounced range |
| D-008 | Publishing content is a separate permission (`content:publish`) reached by a separate endpoint, not an `isActive` field on the edit payload | S10 | The permission exists in the seeded grant set; folding the flag into the edit DTO would make it unreachable, so anyone who could fix a typo could also put an unfinished announcement live |
| D-009 | Production stages are seeded and edit-only — the API offers no create and no delete | S10 | The eight stages and their order come from `CLAUDE.md` §4. A CMS that can add a ninth can publish a process BARFF does not run |
| D-010 | A page section's type-specific payload is an unvalidated JSON `data` column | S10 | Each section type needs a different shape and S12 defines them as it builds each one; a column per type would be mostly nulls, and a schema invented now would be a guess. Nothing is seeded into it |
| D-011 | Editor-supplied link targets must be site-relative; absolute and protocol-relative URLs are refused | S10 | A CMS field accepting `https://…` is an open redirect with an admin form in front of it. `//host` is the same attack and satisfies "starts with a slash", so the pattern excludes it explicitly |
