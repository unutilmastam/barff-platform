# BARFF.UZ — Platform Monorepo

Premium beverage-manufacturer platform for BARFF: public website, dealer portal, admin CMS,
driver PWA and the API behind them.

| Document                                               | Purpose                                                            |
| ------------------------------------------------------ | ------------------------------------------------------------------ |
| [`CLAUDE.md`](./CLAUDE.md)                             | **What** the system is — architecture, rules, source of truth      |
| [`ROADMAP.md`](./ROADMAP.md)                           | **In what order** it gets built — execution steps + progress board |
| [`ASSETS.md`](./ASSETS.md)                             | Which image is what, and where it is used                          |
| [`docs/OPEN-QUESTIONS.md`](./docs/OPEN-QUESTIONS.md)   | Everything not yet confirmed by BARFF                              |
| [`docs/CHANGELOG-STEPS.md`](./docs/CHANGELOG-STEPS.md) | One line per completed roadmap step                                |

> **Current state:** step **S03 — Prisma core schema + seed**. The workspace, the four shared
> packages, the API skeleton and the identity/authorization schema exist. There are still no
> business endpoints — auth lands in S04. `apps/*` and `packages/ui` are empty placeholders,
> filled in by S06–S07.

---

## Requirements

- **Node.js 22** (see `.nvmrc`)
- **pnpm 10** — `corepack enable && corepack prepare pnpm@10.33.0 --activate`
- **Docker** with Compose v2 (for postgres / redis / minio)

## Setup

```bash
corepack enable
pnpm install
cp .env.example .env    # then fill in local values — never commit .env
pnpm docker:up          # postgres + redis + minio
pnpm db:migrate         # apply migrations
pnpm db:seed            # roles, permissions, settings, first admin
```

## Scripts

Run from the repo root. Workspace tasks are orchestrated by Turborepo.

| Script                                           | What it does                                              |
| ------------------------------------------------ | --------------------------------------------------------- |
| `pnpm dev`                                       | Start every app/service in watch mode                     |
| `pnpm build`                                     | Production build of every workspace package               |
| `pnpm test`                                      | Run all test suites                                       |
| `pnpm lint`                                      | ESLint at the root and in every workspace package         |
| `pnpm typecheck`                                 | `tsc --noEmit` at the root and in every workspace package |
| `pnpm format`                                    | Prettier write                                            |
| `pnpm format:check`                              | Prettier check (used in CI)                               |
| `pnpm docker:up` / `docker:down` / `docker:logs` | Local infrastructure                                      |
| `pnpm clean`                                     | Remove build output and `node_modules`                    |

## Ports

| Service                       | Port | URL                               |
| ----------------------------- | ---- | --------------------------------- |
| `apps/web` — public website   | 3000 | http://localhost:3000             |
| `apps/dealer` — dealer portal | 3001 | http://localhost:3001             |
| `apps/admin` — admin CMS      | 3002 | http://localhost:3002             |
| `apps/delivery` — driver PWA  | 3003 | http://localhost:3003             |
| `services/api` — NestJS API   | 4000 | http://localhost:4000/api/v1      |
| Swagger docs                  | 4000 | http://localhost:4000/api/v1/docs |
| PostgreSQL                    | 5432 | —                                 |
| Redis                         | 6379 | —                                 |
| MinIO (S3 API)                | 9000 | http://localhost:9000             |
| MinIO console                 | 9001 | http://localhost:9001             |

Production domains: `barff.uz`, `partner.barff.uz`, `admin.barff.uz`, `delivery.barff.uz`,
`api.barff.uz`.

## Repository layout

```
barff-platform/
├─ apps/
│  ├─ web/          public website        → barff.uz
│  ├─ dealer/       dealer portal         → partner.barff.uz
│  ├─ admin/        admin CMS             → admin.barff.uz
│  └─ delivery/     driver PWA            → delivery.barff.uz
├─ services/
│  └─ api/          NestJS modular monolith → api.barff.uz
├─ packages/
│  ├─ ui/           BARFF design system
│  ├─ types/        shared TS types and enums
│  ├─ config/       shared eslint / tsconfig / tailwind presets
│  ├─ validation/   shared Zod schemas
│  └─ utils/        money, date, slug, formatting helpers
├─ prisma/          schema, migrations, seed
├─ infrastructure/  IaC for AWS
├─ docs/            questions, decisions, step log, runbooks
└─ assets/          source media — see ASSETS.md
```

## Shared packages

| Package             | Contents                                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `@barff/config`     | ESLint / TypeScript / Tailwind presets and the design tokens (§16). See its [README](./packages/config/README.md). |
| `@barff/types`      | Roles, order / delivery / lead statuses, stock movement types, locales, pagination and the API error shape.        |
| `@barff/utils`      | Money (integer minor units), date (Tashkent time), slug (Cyrillic-aware) and display formatting.                   |
| `@barff/validation` | Zod schemas shared by the apps and the API — auth, leads, pagination, localized content.                           |

They are consumed by workspace protocol (`"@barff/types": "workspace:*"`) and built with tsup
into dual ESM/CJS output, so both Next.js and NestJS can import them. Dependency versions for
shared tooling live in the `catalog:` block of `pnpm-workspace.yaml`.

Three rules hold for everything under `packages/`:

- **No runtime coupling.** A shared package must work in the browser and on the server, so no
  `console`, no `process.env` — configuration is passed in by the consumer.
- **No business logic.** State machines, price resolution and authorization live in the API.
  Shared code carries the vocabulary, not the decisions.
- **No invented facts.** Where a real BARFF value is unknown, the schema stays permissive and
  the question goes in `docs/OPEN-QUESTIONS.md`.

TypeScript path aliases (`@barff/types`, `@barff/ui`, …) are declared in `tsconfig.base.json`
for root-level and app use; the packages themselves resolve each other through node_modules.

## API

`services/api` is the NestJS modular monolith behind `api.barff.uz`, served under `/api/v1`.
See its [README](./services/api/README.md) for how the skeleton fits together.

| URL                    | What                                  |
| ---------------------- | ------------------------------------- |
| `/api/v1/health`       | Liveness + Postgres/Redis readiness   |
| `/api/v1/health/live`  | Liveness only — touches no dependency |
| `/api/v1/health/ready` | Readiness only                        |
| `/api/v1/docs`         | Swagger UI — disabled in production   |

Every failure returns `{ statusCode, message, code, requestId }`. Clients branch on `code`;
`message` is human text that gets translated. Quote `requestId` when reporting a problem — it
ties the response to the server logs.

## Database

Schema, migrations and seed live in `prisma/` at the repo root (`CLAUDE.md` §15), which is also
Prisma's default location. `prisma.config.ts` wires them together — the `package.json#prisma`
key it replaces is deprecated in Prisma 6 and removed in 7.

Bringing a database up from nothing:

```bash
pnpm db:migrate:deploy   # or pnpm db:migrate to author a new migration
pnpm db:seed
```

The seed is **idempotent** — every write is an upsert on a natural key, so running it twice
changes nothing and it is safe on every deploy. Two things it deliberately does _not_ overwrite
on a re-run:

- an existing admin's password, because anyone able to trigger a deploy could otherwise reset
  the administrator's credentials;
- a `system_settings` value, because that would silently undo an admin's change.

It seeds the six roles from `CLAUDE.md` §3 (keys taken from `@barff/types`, not retyped), a
49-permission `resource:action` baseline, the role grants, four technical settings, and one
admin user from `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`. If those two are unset the admin is
skipped with a warning and everything else still seeds — staging and production create their
administrator out of band.

Commercial values — minimum order quantity, dealer tiers, credit limits, delivery regions — are
BARFF facts that have not been supplied, so they are absent rather than guessed. See
`docs/OPEN-QUESTIONS.md`.

Passwords are argon2id at the OWASP baseline. The parameters live in exactly one file,
`services/api/src/common/crypto/password.ts`, because the seed writes the first hash and the S04
auth service verifies it — if they drifted the seeded admin simply could not log in, and it
would look like a wrong password rather than a configuration bug.

## Assets

`assets/` holds **source** files and is committed on purpose. Rules:

- never edit files in `assets/` in place;
- optimized derivatives (AVIF/WebP, multiple sizes) are generated by the S08 media pipeline and
  are **not** committed;
- `assets/_needs-review/` is **not approved for production** — do not reference it anywhere.

See [`ASSETS.md`](./ASSETS.md) for the full manifest and the known quality issues.

## Conventions

- **Environments:** development / staging / production, with separate databases, secrets,
  storage and keys. Never point local code at a production database.
- **Secrets:** `.env` is git-ignored; `.env.example` carries variable _names_ only. Production
  secrets live in AWS Secrets Manager.
- **Commits:** `feat(S07): design system package`, `fix(S12): …`, `chore(S00): …`.
- **Branches:** one roadmap step = one branch = one PR, e.g. `step/S07-design-system`.
- **Definition of done:** `CLAUDE.md` §29 plus the step's own DoD in `ROADMAP.md`.

## Working on this repository

1. Read `CLAUDE.md` in full — it wins on any architecture conflict.
2. Open `ROADMAP.md` §2 and take the **first unchecked step**.
3. List the files you will create or modify before writing code.
4. Implement exactly that step, then run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
5. Tick the checkbox, append a line to `docs/CHANGELOG-STEPS.md`, and commit.

Missing BARFF data is never invented — use `MOCK` / `REPLACE_WITH_REAL_DATA` and record the
question in `docs/OPEN-QUESTIONS.md`.
