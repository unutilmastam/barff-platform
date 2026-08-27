# BARFF.UZ — STEP LOG

One line per completed ROADMAP step. Append only; never rewrite history here.

Format:

```
<step> | <YYYY-MM-DD> | <short description> | <PR> | notes: <anything worth knowing>
```

---

S00 | 2026-08-27 | bootstrap monorepo | — | notes: pnpm workspace + turborepo, eslint 9 flat config, prettier, strict tsconfig base with @barff/* aliases, .env.example (names only), docker-compose with postgres/redis/minio + bucket init, docs templates. apps/*, services/api, packages/*, prisma, infrastructure are .gitkeep placeholders — filled by S01-S06. Source assets extracted to assets/ (see ASSETS.md). docker compose validated with `config`; `up` not runnable in the build container.
S01 | 2026-08-27 | shared packages skeleton | — | notes: @barff/config (eslint+tsconfig+tailwind presets, §16 design tokens with placeholder brand ramp per Q-011), @barff/types (as-const enums for roles/order/delivery/lead/movement + locale, pagination, api error), @barff/utils (integer-minor-unit money with exact allocation, Tashkent-time dates, Cyrillic-aware slugs, formatting), @barff/validation (zod 4, depends on types+utils). 109 unit tests pass. Root eslint config and tsconfig.base.json now consume @barff/config. DoD "importable from an app" only partly verifiable — no app exists until S06; proven instead via cross-package imports (validation -> types + utils) and root consumption of @barff/config.
S02 | 2026-08-27 | nestjs api skeleton | — | notes: services/api on Nest 11 under /api/v1. Zod env validation (fail fast, all problems at once), AppConfigService as the only env reader, AsyncLocalStorage request ids echoed on x-request-id, custom JSON logger with central secret redaction (no pino), AllExceptionsFilter emitting @barff/types' ApiError shape, terminus health with real SELECT 1 / PING split into live vs ready, Swagger at /api/v1/docs (off in production), throttler + helmet + strict CORS (no wildcard), pagination/sort DTO helpers with column allow-list, ZodValidationPipe bridging @barff/validation. 55 tests. Health verified green against a real Postgres 16 + Redis, plus the 503 degraded path and recovery. Two bugs found and fixed during verification: the global filter was flattening terminus payloads (a 503 no longer said which dependency was down), and ConfigModule.forRoot() evaluates at import time so test env overrides need vi.hoisted(). pg is a temporary dependency for the DB probe and leaves at S03 when Prisma arrives.
