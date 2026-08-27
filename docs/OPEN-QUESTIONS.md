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

## 4. Decisions to record

Architectural decisions taken because an answer was missing. Revisit when the question is answered.

| ID | Decision | Taken at | Reason |
|---|---|---|---|
| D-001 | MinIO is the local S3-compatible store; the storage provider sits behind an adapter interface | S00 | Keeps local dev off AWS and lets S08 swap providers without touching call sites |
