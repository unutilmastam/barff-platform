# BARFF.UZ — STEP LOG

One line per completed ROADMAP step. Append only; never rewrite history here.

Format:

```
<step> | <YYYY-MM-DD> | <short description> | <PR> | notes: <anything worth knowing>
```

---

S00 | 2026-08-27 | bootstrap monorepo | — | notes: pnpm workspace + turborepo, eslint 9 flat config, prettier, strict tsconfig base with @barff/* aliases, .env.example (names only), docker-compose with postgres/redis/minio + bucket init, docs templates. apps/*, services/api, packages/*, prisma, infrastructure are .gitkeep placeholders — filled by S01-S06. Source assets extracted to assets/ (see ASSETS.md). docker compose validated with `config`; `up` not runnable in the build container.
S01 | 2026-08-27 | shared packages skeleton | — | notes: @barff/config (eslint+tsconfig+tailwind presets, §16 design tokens with placeholder brand ramp per Q-011), @barff/types (as-const enums for roles/order/delivery/lead/movement + locale, pagination, api error), @barff/utils (integer-minor-unit money with exact allocation, Tashkent-time dates, Cyrillic-aware slugs, formatting), @barff/validation (zod 4, depends on types+utils). 109 unit tests pass. Root eslint config and tsconfig.base.json now consume @barff/config. DoD "importable from an app" only partly verifiable — no app exists until S06; proven instead via cross-package imports (validation -> types + utils) and root consumption of @barff/config.
