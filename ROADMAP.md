# BARFF.UZ — BUILD ROADMAP (EXECUTION PLAN)

> Companion file to `CLAUDE.md`.
> `CLAUDE.md` = **what** the system is (architecture, rules, source of truth).
> `ROADMAP.md` = **in what order** it gets built (execution steps + progress state).

---

## 0. HOW TO USE THIS FILE (READ FIRST)

### For Claude Code

1. Read `CLAUDE.md` fully. It always wins on architecture conflicts.
2. Read this file and find the **first step that is not checked off** in section 2 (Progress Board).
3. Work on **exactly one step**. Never jump ahead, never merge two steps.
4. Before writing code for a step:
   - inspect the existing repo,
   - list the files you will create/modify,
   - state assumptions and unknowns.
5. After the step:
   - run `lint`, `typecheck`, `test`, `build`,
   - tick the checkbox for that step in section 2,
   - append a short line to `docs/CHANGELOG-STEPS.md`,
   - commit with the step's commit message.
6. If a step is blocked by missing real BARFF data → use `MOCK` / `REPLACE_WITH_REAL_DATA`, write the open question into `docs/OPEN-QUESTIONS.md`, and continue. Never invent company facts.
7. Never rewrite finished steps to "improve style". Only fix real bugs.

### Prompt template for the user (copy-paste)

```
Read CLAUDE.md and ROADMAP.md.
Execute step S07 only.
Show the file plan first, then implement, then run lint/typecheck/test/build,
then tick the checkbox and commit.
```

### Rules that apply to EVERY step

- Definition of Done = section 29 of `CLAUDE.md` + the step's own DoD.
- Smallest coherent change. No unrelated refactors.
- Business logic server-side. Frontend never decides authorization.
- Every list endpoint: pagination + filtering + consistent error shape.
- Every new UI screen: loading / empty / error states + mobile layout.
- Commit convention: `feat(S07): design system package` / `fix(S12): ...` / `chore(S00): ...`.
- One step = one branch = one PR: `step/S07-design-system`.

---

## 1. PHASE MAP

| Phase | Steps | Outcome |
|---|---|---|
| P0 — Foundation | S00–S06 | Monorepo, API skeleton, auth, CI, web shell |
| P1 — Public site + CMS | S07–S21 | `barff.uz` + `admin.barff.uz` live on staging |
| P2 — Dealer portal | S22–S29 | `partner.barff.uz` ordering works end-to-end |
| P3 — Warehouse + delivery | S30–S35 | Stock, picking, driver PWA `delivery.barff.uz` |
| P4 — Finance + reporting | S36–S39 | Invoices, payments, balances, reports, audit |
| P5 — Infra + optional | S40–S42 | AWS production, hardening, optional extras |

**Hard gate:** a phase does not start until the previous phase's gate step passes (S06, S21, S29, S35, S39).

---

## 2. PROGRESS BOARD

Claude Code updates this list. `[x]` = done and merged.

**Phase 0**
- [x] S00 Repo bootstrap
- [ ] S01 Shared packages skeleton
- [ ] S02 NestJS API skeleton
- [ ] S03 Prisma + core schema + seed
- [ ] S04 Auth + RBAC
- [ ] S05 CI/CD pipeline + Docker
- [ ] S06 Next.js web shell — **PHASE 0 GATE**

**Phase 1**
- [ ] S07 Design system (`packages/ui`)
- [ ] S08 Media/storage module
- [ ] S09 Products domain
- [ ] S10 Content domain (news, certificates, gallery, documents, settings)
- [ ] S11 Public API + caching
- [ ] S12 Web: home + company + products
- [ ] S13 Web: production, quality, gallery, news, contact
- [ ] S14 Leads + B2B form + notifications
- [ ] S15 i18n + SEO
- [ ] S16 Motion layer (GSAP / scroll)
- [ ] S17 3D hero (Three.js)
- [ ] S18 Admin app shell
- [ ] S19 Admin CMS screens
- [ ] S20 Admin leads pipeline
- [ ] S21 Phase 1 QA + staging deploy — **PHASE 1 GATE**

**Phase 2**
- [ ] S22 Dealers domain + registration/approval
- [ ] S23 Pricing engine
- [ ] S24 Dealer app shell + auth
- [ ] S25 Dealer catalog + cart
- [ ] S26 Orders domain + state machine
- [ ] S27 Dealer orders UI + addresses + repeat order
- [ ] S28 Admin order management
- [ ] S29 Phase 2 QA — **PHASE 2 GATE**

**Phase 3**
- [ ] S30 Warehouse schema + stock + movements
- [ ] S31 Reservations + picking + packing
- [ ] S32 Delivery domain + drivers + assignment
- [ ] S33 Driver PWA
- [ ] S34 Admin logistics screens
- [ ] S35 Phase 3 QA — **PHASE 3 GATE**

**Phase 4**
- [ ] S36 Invoices + payments + balances
- [ ] S37 Reports + exports
- [ ] S38 Audit log + viewer
- [ ] S39 Phase 4 QA — **PHASE 4 GATE**

**Phase 5**
- [ ] S40 AWS infrastructure + production deploy
- [ ] S41 Security hardening + observability
- [ ] S42 Optional extras (GPS, routes, CRM/ERP)

---

# PHASE 0 — FOUNDATION

## S00 — Repo bootstrap
**Depends on:** —
**Goal:** Empty but correct monorepo that installs and builds.

Tasks
- `pnpm` workspace + Turborepo per `CLAUDE.md` §15.
- Folders: `apps/web`, `apps/dealer`, `apps/admin`, `apps/delivery`, `services/api`, `packages/*`, `prisma`, `infrastructure`, `docs`.
- Root `tsconfig.base.json`, ESLint, Prettier, `.editorconfig`, `.gitignore`.
- `.env.example` with every variable name (no values).
- `docker-compose.yml`: postgres, redis, minio (S3-compatible local).
- `README.md`: setup, scripts, ports.
- `docs/OPEN-QUESTIONS.md`, `docs/CHANGELOG-STEPS.md` (empty templates).

DoD
- `pnpm install` clean, `pnpm lint` and `pnpm typecheck` pass on empty repo.
- `docker compose up` starts postgres + redis + minio.

Commit: `chore(S00): bootstrap monorepo`

---

## S01 — Shared packages skeleton
**Depends on:** S00

Tasks
- `packages/types` — shared TS types/enums (order status, delivery status, roles, movement types) from `CLAUDE.md` §5, §6, §7.
- `packages/validation` — Zod schemas shared by web/dealer/admin.
- `packages/config` — shared eslint/tsconfig/tailwind presets.
- `packages/utils` — money, date, slug, formatting helpers + unit tests.

DoD: all packages build, are importable from an app, tests pass.
Commit: `feat(S01): shared packages skeleton`

---

## S02 — NestJS API skeleton
**Depends on:** S01

Tasks
- `services/api` NestJS + TS.
- Config module (env validation, fail fast on missing vars).
- Global: `ValidationPipe(whitelist, transform)`, exception filter with consistent error shape `{ statusCode, message, code, requestId }`, request-id middleware, structured logger.
- `GET /api/v1/health` (liveness + db/redis readiness).
- Swagger at `/api/v1/docs`.
- Pagination + sorting DTO helpers.
- Rate limiting + helmet + strict CORS.

DoD: API boots, health green, Swagger renders, e2e smoke test passes.
Commit: `feat(S02): nestjs api skeleton`

---

## S03 — Prisma + core schema + seed
**Depends on:** S02

Tasks
- Prisma init against Postgres.
- Models: `users, roles, permissions, user_roles, role_permissions, system_settings, audit_logs`.
- Indexes: `users.email`, `users.phone`.
- Migration + seed: roles `ADMIN, SALES, WAREHOUSE, LOGISTICS, DRIVER, DEALER`, permission set, one admin user from env.
- Prisma service module + graceful shutdown.

DoD: migrate + seed reproducible from scratch; documented in README.
Commit: `feat(S03): prisma core schema and seed`

---

## S04 — Auth + RBAC
**Depends on:** S03

Tasks
- `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`, `GET /auth/me`.
- Argon2/bcrypt hashing, access + refresh JWT, refresh rotation + revocation in Redis.
- HttpOnly/Secure cookies for browser apps.
- `JwtAuthGuard`, `RolesGuard`, `@Roles()`, `@Permissions()` decorators.
- Login attempt throttling; audit log entry on login and role change.

DoD: unit + e2e tests for success, wrong password, expired token, refresh rotation, forbidden role. No token/password ever logged.
Commit: `feat(S04): auth and server-side rbac`

---

## S05 — CI/CD pipeline + Docker
**Depends on:** S04

Tasks
- `Dockerfile` for `services/api` and for each Next.js app (multi-stage, non-root).
- GitHub Actions `ci.yml`: install → lint → typecheck → test → build, with postgres/redis service containers.
- `deploy-staging.yml` skeleton: build → push ECR → deploy ECS (secrets via repo secrets, no plaintext).
- Branch protection notes in `docs/`.

DoD: CI green on a PR; images build locally.
Commit: `chore(S05): ci pipeline and docker images`

---

## S06 — Next.js web shell — **PHASE 0 GATE**
**Depends on:** S05

Tasks
- `apps/web`: Next.js App Router + TS + Tailwind.
- Tailwind theme tokens: charcoal/black layers, BARFF green accent, typography scale, spacing (§16).
- Root layout, header, footer, container, `not-found`, `error`, `loading`.
- i18n routing scaffold `/uz | /ru | /en` with `uz` default (strings via keys only).
- TanStack Query provider, API client with base URL + error mapping.
- `prefers-reduced-motion` global hook.

DoD: `/uz` renders shell on mobile + desktop; Lighthouse a11y ≥ 90 on the shell; no hard-coded user-facing strings.
Gate check: API boots, auth works, CI green, web shell deploys.
Commit: `feat(S06): web app shell and theme tokens`

---

# PHASE 1 — PUBLIC WEBSITE + CMS

## S07 — Design system (`packages/ui`)
**Depends on:** S06

Tasks
- Primitives: Button, Link, Badge, Input, Select, Textarea, Checkbox, Dialog, Sheet, Tabs, Accordion, Toast, Skeleton, Pagination.
- BARFF surfaces: `GlassCard`, `Section`, `SectionHeader`, `StatBlock`, `MediaFrame`, thin-border style, restrained gradients.
- Dark-first tokens, focus-visible states, keyboard navigation.
- Storybook or a `/dev/ui` route for visual review.

DoD: every primitive documented, a11y-checked, used by at least one page later. No excessive rounding/gradients (§16).
Commit: `feat(S07): barff design system`

---

## S08 — Media/storage module
**Depends on:** S07

Tasks
- API `media` module: upload, list, delete, metadata.
- Pipeline `Upload → MIME/size validation (magic bytes, not extension) → processing → S3 → CDN → DB metadata` (§20).
- Image processing: resize variants, AVIF/WebP output, blur placeholder.
- Private bucket by default; signed URLs for private documents.
- Local dev uses minio; provider behind an adapter interface.

DoD: upload/replace/delete tested; oversized and spoofed files rejected; no public bucket.
Commit: `feat(S08): media pipeline with s3 adapter`

---

## S09 — Products domain
**Depends on:** S08

Tasks
- Schema: `product_categories, products, product_variants, product_images, product_documents, product_prices` + indexes `products.slug`, `products.sku`.
- Localized fields (uz/ru/en) for name, description, ingredients, storage.
- Fields per `CLAUDE.md` §4: category, flavor, volume/variant, SKU/barcode, nutrition, shelf life, gallery, documents, SEO, active, display order.
- CRUD service + admin endpoints + public read endpoints `GET /products`, `GET /products/:slug`.
- Seed with `MOCK` products clearly labelled.

DoD: validation + authorization tests; slug uniqueness; soft-delete or `active` flag respected in public API.
Commit: `feat(S09): products domain`

---

## S10 — Content domain
**Depends on:** S09

Tasks
- Modules: `news`, `certificates`, `gallery_items`, `documents`, `seo_metadata`, `system_settings`, plus homepage `hero` and section content.
- Production steps content model for `Xomashyo → Qabul qilish → Saralash → Ishlab chiqarish → Sifat nazorati → Qadoqlash → Ombor → Yetkazib berish`.
- Localized content, publish/draft state, display order.

DoD: CRUD + public read tested; drafts never exposed publicly.
Commit: `feat(S10): content domain`

---

## S11 — Public API + caching
**Depends on:** S10

Tasks
- Public read controllers grouped under `/api/v1/public/*` (or documented equivalent).
- Redis caching with explicit TTL + invalidation on admin write.
- ETag/Cache-Control headers, response DTO shaping (no internal fields leaked).

DoD: cache hit/miss tested; admin edit invalidates within one request cycle.
Commit: `feat(S11): public api with caching`

---

## S12 — Web: home + company + products
**Depends on:** S11

Tasks
- `/`: hero (static composition for now — 3D lands in S17), statistics (verified data only, else `MOCK`), factory/technology, product carousel, production process, quality/certificates, B2B CTA, news, footer.
- `/company`, `/products`, `/products/[slug]`.
- SSG/ISR where content is static; images via `next/image` with AVIF/WebP.

DoD: real data from API, mobile-first verified at 360px, LCP element is content (not an effect), loading/empty/error states present.
Commit: `feat(S12): home company and product pages`

---

## S13 — Web: remaining public pages
**Depends on:** S12

Tasks
- `/production`, `/quality`, `/partners`, `/news`, `/news/[slug]`, `/gallery`, `/catalog`, `/contact`, `/privacy`, `/terms`.
- Gallery with lazy loading + lightbox; documents list with signed-URL download where private.

DoD: all routes from §4 exist and are linked in navigation/sitemap; no dead links.
Commit: `feat(S13): remaining public pages`

---

## S14 — Leads + notifications
**Depends on:** S13

Tasks
- `leads` + `lead_events` schema; states `NEW → CONTACTED → QUALIFIED → NEGOTIATION → CONVERTED | REJECTED`.
- `POST /leads` with strict validation, rate limit, honeypot/captcha, spam guard.
- `/become-partner` + `/contact` forms (React Hook Form + Zod), success/error UX.
- `notifications` module with provider adapters: in-app, Telegram, email (SMS optional). Event: new lead.

DoD: lead persisted, notification fired via adapter (mock provider in tests), duplicate/spam submissions throttled.
Commit: `feat(S14): b2b leads and notification adapters`

---

## S15 — i18n + SEO
**Depends on:** S14

Tasks
- Full uz/ru/en translation files; zero hard-coded user-facing strings (add a lint rule or check script).
- Per-page: title, meta description, canonical, hreflang, Open Graph, Twitter card.
- `sitemap.xml` (dynamic from products/news), `robots.txt`, semantic HTML, alt text.
- Structured data (Organization, Product, Article) — factual only, no invented ratings/reviews (§19).

DoD: language switch preserves route; SEO fields editable from CMS; validator passes on structured data.
Commit: `feat(S15): i18n and seo`

---

## S16 — Motion layer
**Depends on:** S15

Tasks
- GSAP + ScrollTrigger section reveals, parallax, product transitions, microinteractions.
- Optional Lenis smooth scroll (disable on reduced motion and on low-end mobile).
- Central `motion/` config so timings/easings are consistent, not ad-hoc per component.

DoD: content readable and navigable with JS motion disabled; `prefers-reduced-motion` fully respected; no layout shift caused by animation.
Commit: `feat(S16): gsap motion layer`

---

## S17 — 3D hero
**Depends on:** S16

Tasks
- Three.js + R3F + Drei hero bottle scene, subtle float, fruit/liquid particles.
- `next/dynamic` with `ssr:false`, lazy asset loading, compressed/KTX2 textures, draco/meshopt where useful.
- Device tier detection: simplified or static poster fallback on mobile/low power.

DoD: usable content paints before 3D finishes (§26); measured LCP unaffected; fallback image ships for reduced motion and WebGL-unavailable cases.
Commit: `feat(S17): three.js hero scene`

---

## S18 — Admin app shell
**Depends on:** S17

Tasks
- `apps/admin`: login, session handling, protected layout, sidebar navigation per §8, role-aware menu.
- Server-enforced permissions on every admin endpoint (menu hiding is cosmetic only).
- Data table component: pagination, filter, sort, bulk actions, empty/error states.

DoD: unauthorized role receives 403 from API even when calling endpoints directly.
Commit: `feat(S18): admin shell with rbac`

---

## S19 — Admin CMS screens
**Depends on:** S18

Tasks
- CRUD screens: hero/homepage sections, products + categories + variants + prices, factory, production steps, certificates, news, gallery, documents, media library, contacts, SEO, navigation, settings.
- Localized editors (uz/ru/en tabs), image picker from media library, drag-and-drop ordering, draft/publish.

DoD: every public page's content is editable without touching code; changes appear after cache invalidation.
Commit: `feat(S19): admin cms screens`

---

## S20 — Admin leads pipeline
**Depends on:** S19

Tasks
- Lead list, filters, detail view, status transitions with reason/comment, assignment to sales user, activity timeline from `lead_events`.

DoD: illegal state transitions rejected server-side; every transition audited.
Commit: `feat(S20): admin leads pipeline`

---

## S21 — Phase 1 QA + staging deploy — **PHASE 1 GATE**
**Depends on:** S20

Tasks
- E2E: public B2B lead submission; admin login; admin content edit visible on site.
- Performance pass: Core Web Vitals, image budget, bundle analysis, 3D lazy verification.
- Accessibility pass: keyboard nav, contrast, focus order, alt text.
- Deploy web + admin + api to **staging**; smoke test; write `docs/RELEASE-P1.md`.

Gate: public site + CMS fully usable on staging in three languages on mobile and desktop.
Commit: `chore(S21): phase 1 qa and staging release`

---

# PHASE 2 — DEALER PORTAL

## S22 — Dealers domain
**Depends on:** S21

Tasks
- Schema: `dealers, dealer_addresses, dealer_tiers` + link to `users`.
- Registration request → admin approval/rejection flow; dealer account activation email/Telegram.
- Dealer profile endpoints; address CRUD with default address.

DoD: unapproved dealer cannot access dealer endpoints; approval audited.
Commit: `feat(S22): dealers domain and approval flow`

---

## S23 — Pricing engine
**Depends on:** S22

Tasks
- `product_prices` extended: base price, tier price, regional price, volume discount tiers, promotions, MOQ, currency.
- Deterministic price resolver service: input (dealer, variant, quantity, region, date) → output (unit price, applied rule, discount breakdown).
- Admin UI for price rules.

DoD: unit tests covering every rule precedence case; resolver is the single place prices are computed (frontend never recalculates).
Commit: `feat(S23): dealer pricing engine`

---

## S24 — Dealer app shell
**Depends on:** S23

Tasks
- `apps/dealer`: login, protected layout, navigation (Dashboard, Mahsulotlar & Narxlar, Savat, Buyurtmalar, Yetkazib berish, Manzillar, Hisob-fakturalar, Balans & To'lovlar, Profil, Support).
- Dashboard: recent orders, open deliveries, balance placeholder, quick reorder.
- Mobile-first — dealers order from phones.

DoD: session persistence, refresh flow, logout everywhere.
Commit: `feat(S24): dealer portal shell`

---

## S25 — Dealer catalog + cart
**Depends on:** S24

Tasks
- `GET /dealer/products` with dealer-resolved prices; category/flavor/volume filters, search.
- Cart: server-persisted, per-dealer, MOQ + stock-availability hints, quantity steppers, price recalculated server-side on every change.

DoD: cart survives device switch; tampered client prices are ignored by the server.
Commit: `feat(S25): dealer catalog and cart`

---

## S26 — Orders domain + state machine
**Depends on:** S25

Tasks
- Schema: `orders, order_items, order_status_history` + indexes `orders.dealer_id`, `orders.status`, `orders.created_at`.
- State machine `DRAFT → PENDING_REVIEW → CONFIRMED → RESERVED → PICKING → PACKED → READY_FOR_DELIVERY → DRIVER_ASSIGNED → IN_TRANSIT → DELIVERED` with explicit allowed transitions + cancel path.
- `POST /dealer/orders` (idempotency key), `GET /dealer/orders`, `GET /dealer/orders/:id`.
- Price snapshot stored on order items at submission time.
- Notification: order created.

DoD: invalid transitions rejected with 409; concurrent double-submit creates one order; every transition written to history.
Commit: `feat(S26): orders domain and state machine`

---

## S27 — Dealer orders UI
**Depends on:** S26

Tasks
- Checkout flow `Products → Variant → Quantity → Cart → Address → Review → Submit → Confirmation`.
- Order list + detail with status timeline, repeat order, downloadable order summary.
- Addresses screen; delivery status view (read-only until Phase 3).

DoD: full flow works on a 360px screen; every step has error recovery.
Commit: `feat(S27): dealer order flow ui`

---

## S28 — Admin order management
**Depends on:** S27

Tasks
- `GET /admin/orders` with filters (status, dealer, date, region); `PATCH /admin/orders/:id/status`.
- Order detail: items, resolved prices, dealer info, history, internal notes.
- Sales role scope: leads, dealers, orders, sales reports.

DoD: role-scoped access tested; every status change audited with actor and before/after.
Commit: `feat(S28): admin order management`

---

## S29 — Phase 2 QA — **PHASE 2 GATE**
**Depends on:** S28

Tasks
- E2E: dealer registration → approval → login → order → admin confirmation.
- Load sanity check on catalog and order creation.
- Deploy to staging, `docs/RELEASE-P2.md`.

Gate: a dealer can order without any manual database intervention.
Commit: `chore(S29): phase 2 qa release`

---

# PHASE 3 — WAREHOUSE + DELIVERY

## S30 — Warehouse schema + stock + movements
**Depends on:** S29

Tasks
- Schema: `warehouses, warehouse_stock, stock_movements` + index `warehouse_stock.product_variant_id`.
- Movement types `IN, OUT, RESERVED, RELEASED, TRANSFER, ADJUSTMENT, RETURN`.
- Every stock change is an append-only movement; current stock derived/maintained transactionally.
- Admin screens: stock list, adjustments with reason, movement history.

DoD: stock can never change without a movement row; adjustments require reason + are audited; concurrency tested.
Commit: `feat(S30): warehouse stock and movements`

---

## S31 — Reservations + picking + packing
**Depends on:** S30

Tasks
- `stock_reservations` tied to orders; reserve on `CONFIRMED → RESERVED`, release on cancel/expiry.
- `POST /warehouse/reservations`, `GET /warehouse/stock`.
- Picking list generation, packing confirmation, partial-fulfilment policy decision recorded in `docs/`.
- Low-stock notification event.

DoD: over-reservation impossible under concurrent orders (transaction/lock test).
Commit: `feat(S31): reservations picking packing`

---

## S32 — Delivery domain
**Depends on:** S31

Tasks
- Schema: `drivers, vehicles, deliveries, delivery_events, delivery_routes` + indexes `deliveries.status`, `deliveries.driver_id`.
- States `CREATED → ASSIGNED → PICKED_UP → IN_TRANSIT → ARRIVED → DELIVERED` plus `FAILED`, `CANCELLED`.
- `GET /delivery/assignments`, `PATCH /delivery/:id/status` with role checks.
- Order ↔ delivery status synchronization rules documented and enforced server-side.
- No live GPS tracking (§6).

DoD: driver can only act on own assignments; illegal transitions rejected; events recorded.
Commit: `feat(S32): delivery domain`

---

## S33 — Driver PWA
**Depends on:** S32

Tasks
- `apps/delivery`: installable PWA, phone-first, large touch targets, high contrast for daylight use.
- Today's jobs, delivery detail, customer/address, map link + external navigation handoff.
- Status updates, proof of delivery: photo upload, signature (if required), notes.
- Offline-friendly queue: actions stored locally and synced with idempotency keys.

DoD: works on a mid-range Android phone; queued action after connection loss syncs exactly once.
Commit: `feat(S33): driver pwa`

---

## S34 — Admin logistics screens
**Depends on:** S33

Tasks
- Delivery queue, driver assignment, route grouping, delivery status board, failed-delivery handling and retry.
- Driver + vehicle management.

DoD: dispatcher can run a full day of deliveries from the admin panel.
Commit: `feat(S34): admin logistics`

---

## S35 — Phase 3 QA — **PHASE 3 GATE**
**Depends on:** S34

Tasks
- E2E: order → reserve → pick → pack → assign driver → deliver → stock decremented correctly.
- Reconciliation check: stock movements vs orders vs deliveries.
- Staging deploy + `docs/RELEASE-P3.md`.

Gate: physical fulfilment is fully traceable in the system.
Commit: `chore(S35): phase 3 qa release`

---

# PHASE 4 — FINANCE + REPORTING

## S36 — Invoices + payments + balances
**Depends on:** S35

Tasks
- Schema: `invoices`, `payments`; dealer balance and credit limit.
- Invoice generation from delivered orders, numbering scheme, PDF export.
- Payment recording (manual/admin first), allocation to invoices, balance recalculation.
- Credit limit enforcement at order submission (block or flag — decision documented).

DoD: money math uses integer minor units; balance is derived and reconcilable; every financial change audited.
Commit: `feat(S36): invoices payments and balances`

---

## S37 — Reports + exports
**Depends on:** S36

Tasks
- Reports (§22): sales, orders, dealer performance, product sales, regional sales, stock, stock movements, deliveries, driver performance, lead conversion.
- Filters by date range, region, dealer, product.
- Exports: CSV, XLSX, PDF where required; large exports run as background jobs.

DoD: report numbers match source tables in a verification test; exports stream without blocking the API.
Commit: `feat(S37): reports and exports`

---

## S38 — Audit log + viewer
**Depends on:** S37

Tasks
- Ensure §23 coverage: login, role changes, product/price changes, order status changes, stock adjustments, payment changes, dealer changes, admin settings.
- Record actor, action, entity, entityId, before/after (safe fields only), IP, user agent, timestamp.
- Admin viewer with filters + export; retention policy documented.

DoD: no passwords/secrets/tokens in audit rows (automated check).
Commit: `feat(S38): audit logging and viewer`

---

## S39 — Phase 4 QA — **PHASE 4 GATE**
**Depends on:** S38

Tasks
- E2E: delivered order → invoice → payment → balance → report reflects it.
- Full regression of the main flow (§28).
- `docs/RELEASE-P4.md`.

Commit: `chore(S39): phase 4 qa release`

---

# PHASE 5 — INFRASTRUCTURE + OPTIONAL

## S40 — AWS infrastructure + production deploy
**Depends on:** S39

Tasks
- `Internet → Cloudflare → ALB → ECS Fargate → NestJS API` (§13).
- RDS PostgreSQL (private subnet), ElastiCache Redis, S3 (private), ECR, CloudWatch, Secrets Manager.
- IaC in `infrastructure/` (Terraform or CDK — choose one and document).
- Environments: development / staging / production with separate DBs, secrets, storage, keys (§14).
- Backups + restore drill, migration strategy on deploy, rollback plan.

DoD: production deploy is one pipeline run; restore from backup verified once.
Commit: `chore(S40): aws production infrastructure`

---

## S41 — Security hardening + observability
**Depends on:** S40

Tasks
- Cloudflare WAF rules, rate limits per route class, secure headers audit, CORS review.
- Optional MFA for admin accounts.
- Dependency and container scanning in CI; secret scanning.
- Logs/metrics/alerts: error rate, latency, failed logins, queue depth, low stock.
- `docs/RUNBOOK.md` for incidents.

DoD: no secrets in repo or images; alerts fire in a test incident.
Commit: `chore(S41): security hardening and observability`

---

## S42 — Optional extras
**Depends on:** S41 — build only on explicit request

- GPS tracking, route optimization, CRM, ERP integration, native mobile apps, advanced analytics (§27 Phase 5).

Commit: `feat(S42): <specific extra>`

---

## 3. STANDING BLOCKERS — REAL DATA NEEDED FROM BARFF

Keep these in `docs/OPEN-QUESTIONS.md` and use `MOCK` / `REPLACE_WITH_REAL_DATA` until answered:

- production capacity, employee count, founding year, export countries
- certifications and certificate documents (real files)
- legal address, warehouse addresses, phone numbers, bank details
- full product list: names, SKUs, barcodes, volumes, ingredients, nutrition, shelf life
- product photography and factory photo/video assets
- dealer tiers, real price lists, discount and MOQ policy, credit limit policy
- delivery regions and logistics rules
- invoice/legal requirements (numbering, tax fields, signatures)
- domains, DNS access, hosting accounts, Telegram bot token, SMS/email provider accounts

---

## 4. STEP LOG

Claude Code appends one line per completed step to `docs/CHANGELOG-STEPS.md`:

```
S00 | 2026-08-27 | bootstrap monorepo | PR #1 | notes: minio used for local S3
```
