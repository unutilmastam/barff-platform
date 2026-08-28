# BARFF.UZ --- CLAUDE PROJECT ARCHITECTURE

## 1. Mission

Build BARFF.UZ as a premium beverage-manufacturer platform, not a
generic corporate template.

Products: - Public website: `barff.uz` - Dealer portal:
`partner.barff.uz` - Admin CMS: `admin.barff.uz` - Driver PWA:
`delivery.barff.uz` - Backend API: `api.barff.uz`

Reference visual direction: - cinematic dark interface - BARFF green
accents - premium product bottles - factory photography/video -
glass/translucent cards - large typography - smooth scroll - tasteful
3D - GSAP/Three.js motion - excellent mobile version

Never invent real company facts. Production capacity, employees,
certifications, export countries, addresses and product specifications
must be supplied by BARFF. Use clearly marked mock data until verified.

## 2. Stack

Frontend: - Next.js + React + TypeScript - Tailwind CSS - shadcn/ui
where useful - TanStack Query - React Hook Form + Zod - Zustand only
when needed

Visual: - Three.js + React Three Fiber + Drei - GSAP - optional Lenis -
respect `prefers-reduced-motion`

Backend: - NestJS + TypeScript - REST API - Swagger/OpenAPI - modular
monolith first; do NOT start with unnecessary microservices

Data: - PostgreSQL - Prisma - Redis - S3-compatible object storage

Cloud: - AWS ECS Fargate - RDS PostgreSQL - ElastiCache Redis - S3 -
ECR - CloudWatch - Secrets Manager - Cloudflare CDN/WAF/SSL - GitHub
Actions + Docker

## 3. User roles

Visitor: - browse website - products - factory - quality/certificates -
news - gallery - contact - B2B lead - public documents

Dealer: - login - dashboard - dealer prices - product catalog - cart -
orders - delivery tracking - addresses - invoices - balance/payments -
profile - repeat order

Sales: - leads - dealers - orders - sales reports

Warehouse: - stock - reservations - picking - packing - stock movements

Logistics: - delivery queue - driver assignment - routes - delivery
status

Driver: - assigned deliveries - map/navigation - status updates - proof
of delivery - photo/signature/note

Admin: - full CMS - users/roles - products/prices - dealers - orders -
warehouse - delivery - invoices/payments - leads - news - certificates -
media - reports - settings - audit logs

Use server-side RBAC. Never rely only on hiding frontend buttons.

## 4. Public website

Routes: - `/` - `/company` - `/products` - `/products/[slug]` -
`/production` - `/quality` - `/partners` - `/news` - `/news/[slug]` -
`/gallery` - `/contact` - `/become-partner` - `/catalog` - `/privacy` -
`/terms`

Home sections: 1. Hero: cinematic 3D/product composition, headline, CTA,
optional video. 2. Company statistics: only verified facts. 3.
Factory/technology. 4. Product carousel. 5. Production process. 6.
Quality/certificates. 7. B2B partnership CTA. 8. News. 9. Footer.

Production process:
`Xomashyo -> Qabul qilish -> Saralash -> Ishlab chiqarish -> Sifat nazorati -> Qadoqlash -> Ombor -> Yetkazib berish`

Product pages must support: - name/slug - localized content - category -
flavor - volume/variant - SKU/barcode if available - ingredients -
nutrition - storage - shelf life - images/gallery -
documents/certificates - SEO metadata - active/display order

## 5. Dealer portal

Navigation: - Dashboard - Mahsulotlar & Narxlar - Savat - Buyurtmalar -
Yetkazib berish - Manzillar - Hisob-fakturalar - Balans & To'lovlar -
Profil - Support

Order flow:
`Login -> Products -> Variant -> Quantity -> Cart -> Address -> Review -> Submit -> Confirmation`

Order states:
`DRAFT -> PENDING_REVIEW -> CONFIRMED -> RESERVED -> PICKING -> PACKED -> READY_FOR_DELIVERY -> DRIVER_ASSIGNED -> IN_TRANSIT -> DELIVERED`

Also support: - dealer tiers - dealer-specific prices - volume
discounts - minimum order quantity - regional pricing - promotions -
credit limits where applicable

## 6. Delivery

Delivery states:
`CREATED -> ASSIGNED -> PICKED_UP -> IN_TRANSIT -> ARRIVED -> DELIVERED`
with `FAILED` and `CANCELLED`.

Driver PWA: - today's jobs - delivery detail - customer/address - map -
navigation - status changes - proof of delivery - photo - signature if
required - notes - offline-friendly queue if practical

Do not add live GPS tracking unless explicitly required.

## 7. Warehouse

Modules: - warehouses - stock - reservations - stock movements -
picking - packing - transfers - adjustments

Movement types:
`IN, OUT, RESERVED, RELEASED, TRANSFER, ADJUSTMENT, RETURN`

Every stock change must be auditable.

## 8. Admin CMS

Dashboard: - orders - sales/revenue if available - dealers - leads -
deliveries - low stock - activity

CMS: - hero - homepage sections - products/categories - factory -
production steps - certificates - news - gallery - documents -
contacts - SEO - navigation

Operations: - dealers - orders - warehouse - delivery/drivers -
invoices - payments - leads

System: - users - roles - permissions - notifications - settings - audit
logs

## 9. B2B lead

Public form: - company - contact - phone - email - region - business
type - desired products - estimated monthly volume - message

Lead states: `NEW -> CONTACTED -> QUALIFIED -> NEGOTIATION -> CONVERTED`
or `REJECTED`.

## 10. Database

Core entities:
`users, roles, permissions, user_roles, role_permissions, dealers, dealer_addresses, dealer_tiers, products, product_categories, product_variants, product_images, product_documents, product_prices, orders, order_items, order_status_history, warehouses, warehouse_stock, stock_movements, stock_reservations, drivers, vehicles, deliveries, delivery_events, delivery_routes, payments, invoices, leads, lead_events, notifications, news, certificates, gallery_items, documents, seo_metadata, audit_logs, system_settings`

Important indexes: - users.email - users.phone - products.slug -
products.sku - orders.dealer_id - orders.status - orders.created_at -
warehouse_stock.product_variant_id - deliveries.status -
deliveries.driver_id - leads.status

## 11. Backend modules

NestJS:
`auth, users, roles, permissions, dealers, products, pricing, orders, warehouse, delivery, drivers, payments, invoices, notifications, leads, news, certificates, media, reports, seo, settings, audit`

Each module should have: - controller - service - DTO - validation -
data-access/repository - tests

Controllers must stay thin; business logic belongs in services/domain
layers.

API base: `https://api.barff.uz/api/v1`

Examples: - `POST /auth/login` - `POST /auth/refresh` -
`GET /products` - `GET /products/:slug` - `GET /dealer/dashboard` -
`GET /dealer/products` - `POST /dealer/orders` -
`GET /dealer/orders/:id` - `GET /dealer/deliveries` -
`GET /admin/orders` - `PATCH /admin/orders/:id/status` -
`GET /warehouse/stock` - `POST /warehouse/reservations` -
`GET /delivery/assignments` - `PATCH /delivery/:id/status`

All requests require validation, authorization where needed, pagination
for lists, filtering/sorting where useful, consistent errors and request
IDs.

## 12. Security

-   HTTPS everywhere
-   Cloudflare WAF/CDN
-   rate limiting
-   secure headers
-   strict CORS
-   input validation
-   JWT/refresh-token strategy
-   HttpOnly/Secure cookies where appropriate
-   RBAC
-   optional MFA for admins
-   private database subnet
-   S3 private by default
-   signed URLs for private documents
-   AWS Secrets Manager

Never: - commit secrets - store plaintext passwords - expose DB
credentials - trust frontend role checks - log passwords/tokens - use
production DB for development

## 13. Cloud

Recommended production path:

`Internet -> Cloudflare -> AWS Load Balancer -> ECS Fargate -> NestJS API`

Backend connects to: - RDS PostgreSQL - ElastiCache Redis - S3 -
background workers/queues - notification providers

Use Kubernetes/EKS only if actual scale/operations justify it. Start
with ECS Fargate.

## 14. Environments

-   development
-   staging
-   production

Keep separate: - databases - secrets - storage - API keys - analytics
where appropriate

## 15. Repository

Recommended monorepo:

`barff-platform/` - `apps/web` - `apps/dealer` - `apps/admin` -
`apps/delivery` - `services/api` - `packages/ui` - `packages/types` -
`packages/config` - `packages/validation` - `packages/utils` -
`prisma` - `infrastructure` - `docs` - `.env.example` -
`docker-compose.yml` - `package.json` - `pnpm-workspace.yaml` -
`turbo.json`

Use pnpm + Turborepo when justified.

## 16. Design system

Visual language: - deep black/charcoal layered backgrounds - BARFF green
accent - premium whitespace - large modern typography -
glass/translucent surfaces - thin borders - restrained gradients -
premium bottle/product photography - factory imagery - subtle
particles/liquid visuals

Avoid: - generic templates - excessive rounded cards - excessive
gradients - visual clutter - animation that harms usability

## 16a. Theme

The site supports both dark and light mode.

-   Dark is the default and the primary art direction.
-   Light mode is a first-class theme, not an inversion --- it needs its
    own surface, border and shadow values.
-   Respect `prefers-color-scheme`; provide a manual toggle that
    persists.
-   Every token pair must pass WCAG AA in BOTH themes. The contrast test
    in `@barff/config` must cover light mode too.

## 17. 3D and motion

Use: - hero bottle scene - subtle floating motion - fruit/liquid
particles - parallax - section reveals - product transitions -
interactive cards - microinteractions

Performance rules: - dynamic import heavy 3D - lazy-load assets -
compress textures - use AVIF/WebP - video poster/fallback - simplify
effects on mobile - support reduced motion - never make animation the
only way to understand content

## 17a. Reactive colour

Product hover drives an accent colour:

-   Hovering a bottle shifts the page accent to that juice colour
    (anor, apelsin, olcha, shaftoli, olma, multifrukt,
    qulupnay-ananas).
-   The shift is a CSS custom property transition, not a re-render.
-   Accent affects glow, highlights and small UI accents only. Body
    text, surfaces and borders never change --- contrast must stay AA at
    every point of the transition.
-   Touch devices have no hover: use viewport-centre detection on scroll
    instead. The effect is decorative and never carries meaning.

## 17b. Pointer motion

Pointer-driven effects (parallax, tilt, magnetic buttons, cursor glow)
apply on `pointer:fine` devices only. They are always additive --- the
page must be complete and usable without them.

## 18. i18n

Languages: - UZ - RU - EN

Do not hard-code large user-facing strings inside components. Use
translation keys. Store localized product/news content appropriately.

## 19. SEO

For every public page: - title - meta description - canonical - Open
Graph - social metadata - sitemap - robots - semantic HTML - alt text -
structured data when factual

Never generate fake ratings, reviews or certificates.

## 20. Media

Admin media: - product images - factory images - certificates - PDFs -
videos

Pipeline:
`Upload -> MIME/size validation -> processing -> S3 -> CDN -> DB metadata`

Never trust file extensions alone.

## 21. Notifications

Events: - new lead - dealer registration - order created - order status
changed - delivery assigned/completed - payment received - low stock -
system error

Channels: - in-app - Telegram - email - SMS if required

Use provider adapters instead of hard-coding one vendor.

## 22. Reports

Admin: - sales - orders - dealer performance - product sales - regional
sales - stock - stock movements - deliveries - driver performance - lead
conversion

Exports: - CSV - XLSX - PDF if required

## 23. Audit

Audit sensitive operations: - login - role changes - product/price
changes - order status changes - stock adjustments - payment changes -
dealer changes - admin settings

Record actor, action, entity, entityId, before/after where safe, IP,
user agent, timestamp.

Never record passwords or secrets.

## 24. Testing

Critical E2E flows: 1. public B2B lead 2. dealer login 3. dealer order
4. admin order confirmation 5. warehouse processing 6. driver delivery
completion

Also: - unit tests - integration/API tests - component tests -
typecheck - lint - production build

## 25. CI/CD

`GitHub -> GitHub Actions -> tests -> Docker build -> ECR -> ECS deployment`

Never deploy untested production builds.

## 26. Performance

Goals: - excellent Core Web Vitals - fast initial render - optimized
images - CDN caching - SSR/SSG where appropriate - code splitting -
dynamic loading for heavy 3D

Usable content must appear before heavy visual effects finish loading.

## 27. Implementation phases

Phase 1: - public website - CMS - products - production - quality -
news - gallery - contact - i18n - SEO

Phase 2: - dealer registration/approval - dealer login - dealer
dashboard - dealer pricing - cart - orders - addresses

Phase 3: - warehouse - stock - order processing - logistics - driver
PWA - delivery workflow

Phase 4: - invoices - payments - balances - credit limits - financial
reporting

Phase 5: - optional GPS - route optimization - CRM - ERP integration -
mobile apps - advanced analytics

Do not build Phase 5 before core flows are stable.

## 28. Main business flow

`PUBLIC WEBSITE -> B2B LEAD -> SALES -> DEALER ACCOUNT -> DEALER ORDER -> WAREHOUSE -> PACKING -> LOGISTICS -> DRIVER -> DELIVERY -> INVOICE/PAYMENT -> REPORTING`

This is the central business workflow.

## 29. Definition of done

A feature is complete only when: - desktop works - mobile works -
loading/empty/error states exist - accessibility is considered -
validation exists - authorization exists - server validation exists -
migrations exist if needed - tests cover critical logic - no secrets are
exposed - lint passes - typecheck passes - tests pass - production build
passes

## 30. Rules for Claude

Before coding: 1. Read this entire file. 2. Inspect the existing
repository. 3. Identify affected modules. 4. Preserve working
functionality. 5. Make the smallest coherent change. 6. Reuse components
and types. 7. Keep business logic server-side. 8. Validate external
input. 9. Add tests for important business logic. 10. Run
lint/typecheck/tests/build.

Never invent BARFF facts. Use mock data marked `MOCK` or
`REPLACE_WITH_REAL_DATA`.

Never: - rewrite the whole project for a small feature - add unnecessary
dependencies - create unnecessary microservices - remove security
checks - expose secrets - hard-code production credentials - silently
break existing functionality

When architecture conflicts with a requested feature: - explain the
conflict briefly - propose an architecture-compatible solution -
implement the safest option

The single source of truth for project architecture is this file.
