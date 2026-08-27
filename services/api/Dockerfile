# BARFF API image.
#
# Built from the REPOSITORY ROOT, not from services/api:
#   docker build -f services/api/Dockerfile -t barff-api .
# The API depends on workspace packages (@barff/types, @barff/utils,
# @barff/validation) and on prisma/schema.prisma at the root, so a context
# scoped to services/api could not resolve them.
#
# Base is Debian slim rather than Alpine on purpose: argon2 is a native addon
# and Prisma ships platform-specific query engines. Both publish glibc
# prebuilds; on musl they would have to be compiled from source in every build,
# and a subtly mismatched binary fails at runtime rather than at build time.

# ---------------------------------------------------------------------------
# 1. deps — install once, cached until a manifest or the lockfile changes
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS deps
WORKDIR /app

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

# Manifests only, so editing source does not invalidate the install layer.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/config/package.json      packages/config/
COPY packages/types/package.json       packages/types/
COPY packages/utils/package.json       packages/utils/
COPY packages/validation/package.json  packages/validation/
COPY services/api/package.json         services/api/

# --frozen-lockfile: CI and the image must install exactly what was reviewed.
# A lockfile silently updated during a build is a supply-chain change nobody saw.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ---------------------------------------------------------------------------
# 2. build — generate the Prisma client, compile packages and the API
# ---------------------------------------------------------------------------
FROM deps AS build
WORKDIR /app

COPY prisma           prisma/
COPY prisma.config.ts tsconfig.base.json tsconfig.json turbo.json ./
COPY packages         packages/
COPY services/api     services/api/

# The generator writes to services/api/generated/prisma (set explicitly in
# schema.prisma). The default output lands in a pnpm virtual-store path that
# `pnpm deploy` does not carry, and the resulting image crash-looped with
# "Cannot find module '.prisma/client/default'".
RUN pnpm exec prisma generate

# `@barff/api...` builds the workspace packages it depends on first.
RUN pnpm turbo run build --filter=@barff/api...

# Self-contained production tree: prod dependencies only, workspace packages
# copied in rather than symlinked out of the monorepo.
#
# The deployed tree carries only services/api/package.json, so the
# `onlyBuiltDependencies` list in pnpm-workspace.yaml does not reach it — that
# is why the same list is repeated under `pnpm` in that package.json. Without
# it argon2's postinstall is skipped, no native addon is produced, and every
# login fails at runtime.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm deploy --filter=@barff/api --prod --legacy /prod/api

# ---------------------------------------------------------------------------
# 3. runtime — no pnpm, no toolchain, no source
# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
# Fail fast rather than listening on a port nothing routes to.
ENV API_PORT=4000
ENV API_HOST=0.0.0.0

# `node` (uid 1000) ships with the base image. A container that runs as root
# hands a process escape the whole filesystem (§12).
COPY --from=build --chown=node:node /prod/api ./

USER node
EXPOSE 4000

# The readiness probe is the real check, but this makes a bare `docker run`
# self-reporting too. `/health/live` deliberately touches no dependency, so a
# container is not called unhealthy because Postgres is down.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.API_PORT||4000)+'/api/v1/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Exec form: node becomes PID 1 and receives SIGTERM directly, which is what
# triggers Nest's shutdown hooks and closes the Prisma and Redis connections.
# A shell wrapper would swallow the signal and ECS would kill the task instead.
CMD ["node", "dist/main.js"]
