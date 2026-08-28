# @barff/api

NestJS modular monolith behind `api.barff.uz`. Base path: `/api/v1`.

> **Current state:** step **S02 — API skeleton**. Config, logging, error handling,
> health, Swagger, rate limiting and the pagination helpers exist. There are no
> business endpoints yet — persistence lands in S03, auth in S04.

## Running

```bash
pnpm docker:up                       # postgres + redis (from the repo root)
cp ../../.env.example .env           # then fill in DATABASE_URL and REDIS_URL
pnpm db:migrate && pnpm db:seed      # from the repo root
pnpm --filter @barff/api dev
```

| URL                                       | What                                  |
| ----------------------------------------- | ------------------------------------- |
| http://localhost:4000/api/v1/health       | Liveness + Postgres/Redis readiness   |
| http://localhost:4000/api/v1/health/live  | Liveness only                         |
| http://localhost:4000/api/v1/health/ready | Readiness only                        |
| http://localhost:4000/api/v1/docs         | Swagger UI (not served in production) |
| http://localhost:4000/api/v1/docs-json    | OpenAPI document                      |

## How the skeleton is put together

**Configuration.** `AppConfigService` is the only supported way to read config;
nothing else touches `process.env`. The Zod schema in `env.schema.ts` is the
single place a variable is named, defaulted and typed, and the process refuses
to start if it is missing or malformed — with every problem listed at once.

> `ConfigModule.forRoot()` is a decorator argument, so it is evaluated when the
> module graph is **imported**. A test that overrides the environment inside
> `beforeAll` is already too late; use `vi.hoisted()`.

**Errors.** One shape, always: `{ statusCode, message, code, requestId }`,
implementing `ApiError` from `@barff/types` so browser clients type their
handling against the same definition the server satisfies. Clients branch on
`code`, never on `message`. A 5xx returns a generic message and sends the real
error to the log under the same `requestId` the caller received — an unhandled
database error must never hand a client our SQL.

The one documented exception: `@nestjs/terminus` health payloads pass through
untouched, because flattening them would leave an operator with a 503 and no
idea _which_ dependency is down.

**Request ids.** `RequestIdMiddleware` assigns one per request, echoes it on
`x-request-id`, and puts it in `AsyncLocalStorage` so the logger and filter can
reach it without threading a transport concern through the domain layer. An
inbound id is reused so a trace survives Cloudflare and the load balancer — but
only after a format check, since the value is attacker-controlled and ends up
in log records.

**Logging.** One JSON object per line on stdout, with a central redaction pass:
any key containing `password`, `token`, `secret`, `authorization`, … is replaced
before serialization. Relying on every call site to remember §12 will fail
eventually; redaction on the way out will not.

**Health.** Liveness and readiness are separate because an orchestrator reacts
differently to each. Liveness answers "is the process wedged?" and touches no
dependency — restarting the API does not fix a database outage, it just removes
capacity during one. Readiness answers "can this instance serve traffic?" and
does a real `SELECT 1` and `PING`, because a socket that opens but cannot
authenticate is exactly what a readiness probe is for. Both are exempt from
throttling: probes poll on a fixed interval, and rate-limiting them turns a busy
minute into a false outage.

**Validation.** Two pipes, on purpose:

- the global `ValidationPipe` (class-validator, `whitelist` +
  `forbidNonWhitelisted` + `transform`) for DTO classes, which is what Swagger
  introspects. Unknown properties are rejected rather than stripped — a silently
  dropped `?pagesize=50` typo looks like it worked.
- `ZodValidationPipe` for endpoints where the browser and server must agree
  exactly, so one schema from `@barff/validation` drives both the React Hook
  Form resolver and the server check.

**Lists.** `PaginationQueryDto` and `SortableQueryDto([...])` take their bounds
from `@barff/types`. Sorting is restricted to an explicit column allow-list:
passing a client-supplied field to the ORM would let anyone order by any column,
including unindexed ones.

**Rate limiting** is a guard, so it only runs on routes that matched a
controller. Hammering an unknown path returns 404s forever and never trips the
limit — that is Nest's design, but it makes "I tested it against /nope" a
misleading way to verify throttling.

## Auth and RBAC

`POST /auth/login` · `POST /auth/refresh` · `POST /auth/logout` · `GET /auth/me`

**Deny by default.** `JwtAuthGuard` is global; a route is reachable without a
token only if it says `@Public()`. Guarding each controller individually fails
silently the first time someone forgets, and nothing notices an unguarded
endpoint unless a test was written for it specifically.

**Tokens.** A short-lived access token (15 min) carries the user's roles and
permissions; a long-lived refresh token carries neither, so it grants no
authority of its own. They are signed with **different secrets** — sharing one
would make a refresh token a valid access token and the short access lifetime
would buy nothing. The env schema refuses to start if they match.

**Rotation and reuse detection.** Refreshing consumes the presented token and
issues a new one. If an already-rotated token appears again, the token leaked —
and the server cannot tell the thief from the user, so the whole session family
is revoked and both re-authenticate. Losing a session is much cheaper than
leaving a live stolen credential in circulation.

**Cookies, and why the body is usually empty.** Login sets HttpOnly, SameSite=Lax
cookies; the refresh cookie is scoped to `/api/v1/auth/refresh`, since it is the
account-takeover credential and should not ride along on every request. Tokens
appear in the response body **only** when the client sends
`X-Token-Delivery: body` — the driver PWA needs raw tokens for its offline
queue. A browser that never sees the token in a readable body cannot be talked
into putting it in `localStorage`, which is the entire point of the HttpOnly
cookie.

**No user enumeration.** Unknown account, wrong password, locked account and
deactivated account all return the same 401 with the same message and code. The
unknown-account path still runs a hash so it does not answer measurably faster —
otherwise response timing reopens the hole the identical message just closed.
The audit log records what actually happened.

**Two-layer login throttle.** Per-IP (10/min on `/auth/login`) and per-account
(`failedLoginAttempts` / `lockedUntil`). Neither alone is enough: IP-only is
beaten by a botnet, account-only by spraying one password across thousands of
accounts.

**Authorization.** `@Roles()` and `@Permissions()`; prefer permissions, since
roles change shape as the business grows. `@Permissions()` requires _all_
listed keys. Refusals never name the missing role or permission — probing
endpoints should not yield a map of the permission model.

Known trade-off: permissions ride in the signed access token, so a revoked
permission stays usable until that token expires (≤15 min). Refreshing re-reads
them from the database, and revoking the session cuts it short immediately. The
alternative — a lookup per request — buys instant revocation at the price of
making every authenticated request depend on another service being up.

## Media (§20)

`POST /media` · `PUT /media/:id/file` · `GET /media` · `GET /media/:id` ·
`DELETE /media/:id`. Every route needs a permission; there is no public upload
and no public listing.

**Type comes from the bytes.** Extension and `Content-Type` are both chosen by
the uploader, so neither is consulted for the decision — only magic bytes, from
a six-format allow-list. **SVG is rejected** even though it is an image format:
it can carry `<script>`, and serving a user-uploaded one from our own origin is
stored XSS. Brand vector logos are developer-committed assets, not uploads.

**Images are re-encoded, never stored as received.** That strips EXIF — factory
and delivery photos carry GPS coordinates and device identifiers nobody meant to
publish — and it neutralises a file crafted to be both a valid image and a valid
script. sharp is also given a pixel ceiling, because a decompression bomb is a
few kilobytes on disk and tens of gigabytes in memory, and a byte-size limit
alone does not catch it.

Variants are AVIF and WebP at 200/600/800/1200px — the sizes `ASSETS.md` says
the site actually renders — plus a 16px inline blur placeholder. Nothing is ever
upscaled.

**Private by default.** A caller that says nothing about visibility gets the safe
option. Private assets are reachable only through a short-lived signed URL; the
bucket is never public and no ACL is ever sent on a `PutObject`.

**Ordering matters** in two places: the database row is written *after* the
bytes are stored, because a stray object is a sweep away and a row pointing at
nothing is a broken page; and on replace, the old objects are deleted *after*
the new ones land, so a mid-way failure leaves the asset serving its previous
content rather than nothing.

Storage sits behind `StorageProvider`. Two implementations ship: S3 (which also
covers MinIO) and a filesystem provider for local work. The choice is made once
at boot from configuration — no service branches on it — and production is
prevented from selecting `filesystem` by the env schema, since the container
disk is discarded on every deploy.

## Tests

```bash
pnpm --filter @barff/api test
```

Vitest, not Jest — the workspace has one test runner. NestJS DI needs
`emitDecoratorMetadata`, which esbuild cannot emit, so `unplugin-swc` replaces
it as the transformer.

`test/health-degraded.e2e-spec.ts` points the connection strings at port 1
(reserved, never listening) rather than stopping the real services, so the suite
stays self-contained.

**Database.** `PrismaService` extends `PrismaClient` and is provided globally.
Repositories live in their feature module — controllers never talk to Prisma
directly (§11). The schema is at `prisma/` in the repo root.

A failed connection at startup is **logged, not thrown**. A malformed
`DATABASE_URL` is a configuration error and the env schema already refuses to
start for it; an unreachable database is an operational condition, and crashing
would turn a brief RDS blip during a deploy into every task failing to start —
a total outage instead of a degraded one. Readiness reports `down`, the load
balancer stops routing, and Prisma reconnects on the next query.

The readiness probe now shares that pool rather than opening its own. A probe
with a private connection can report "up" while the pool serving requests is
exhausted, which is precisely the outage it should catch.

## Notes for later steps

- Swagger is disabled in production: the endpoint list is a map of the attack
  surface and BARFF has no third-party API consumers. Staging keeps it.
- The structured logger is deliberately not pino. The requirement is redaction
  (§12), and owning the serializer is the shortest path to guaranteeing it.
  Nothing outside `structured-logger.service.ts` knows the format, so **S41**
  can swap it.
