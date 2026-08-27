# Shared Dockerfile for the four Next.js apps (web, dealer, admin, delivery).
#
# NOT YET IN USE. `apps/*` are placeholders until S06 creates `apps/web`; this
# is here so S06 wires an app up rather than inventing a build. Four
# copy-pasted Dockerfiles would drift, and a base-image or CVE fix would have
# to be applied four times.
#
# Build from the repository root:
#   docker build -f infrastructure/docker/nextjs.Dockerfile \
#                --build-arg APP_NAME=web -t barff-web .
#
# Requires `output: 'standalone'` in the app's next.config — that is what
# produces the self-contained server bundle copied below.

ARG APP_NAME

FROM node:22-bookworm-slim AS deps
WORKDIR /app
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages ./packages
COPY apps ./apps
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

FROM deps AS build
ARG APP_NAME
WORKDIR /app
COPY tsconfig.base.json turbo.json ./
COPY packages ./packages
COPY apps ./apps

# Next inlines NEXT_PUBLIC_* at build time, so they are build args rather than
# runtime env. Nothing secret may go in one: it ends up in the client bundle.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm turbo run build --filter=@barff/${APP_NAME}...

FROM node:22-bookworm-slim AS runtime
ARG APP_NAME
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# The standalone output already contains the pruned node_modules it needs;
# `static` and `public` are served from disk and are not part of it.
COPY --from=build --chown=node:node /app/apps/${APP_NAME}/.next/standalone ./
COPY --from=build --chown=node:node /app/apps/${APP_NAME}/.next/static ./apps/${APP_NAME}/.next/static
COPY --from=build --chown=node:node /app/apps/${APP_NAME}/public ./apps/${APP_NAME}/public

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)).then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# ARG does not expand inside exec-form CMD, so the app path is baked into an
# env var at build time and the entrypoint is a fixed, signal-transparent
# exec. A shell-form CMD would put a shell at PID 1 and swallow SIGTERM.
ENV APP_SERVER=apps/${APP_NAME}/server.js
CMD ["sh", "-c", "exec node \"$APP_SERVER\""]
