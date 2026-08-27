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

> **Current state:** step **S00 — Repo bootstrap**. The workspace, tooling and local
> infrastructure exist; the apps and services are still empty placeholders. They are filled in
> by S01–S06.

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

TypeScript path aliases (`@barff/types`, `@barff/ui`, …) are declared in `tsconfig.base.json`.

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
