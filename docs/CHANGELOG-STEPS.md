# BARFF.UZ — STEP LOG

One line per completed ROADMAP step. Append only; never rewrite history here.

Format:

```
<step> | <YYYY-MM-DD> | <short description> | <PR> | notes: <anything worth knowing>
```

---

S00 | 2026-08-27 | bootstrap monorepo | — | notes: pnpm workspace + turborepo, eslint 9 flat config, prettier, strict tsconfig base with @barff/* aliases, .env.example (names only), docker-compose with postgres/redis/minio + bucket init, docs templates. apps/*, services/api, packages/*, prisma, infrastructure are .gitkeep placeholders — filled by S01-S06. Source assets extracted to assets/ (see ASSETS.md). docker compose validated with `config`; `up` not runnable in the build container.
