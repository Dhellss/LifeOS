# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# LifeOS production image
#
# Multi-stage build producing a Next.js standalone server:
#   deps  -> install dependencies with a cached lockfile
#   build -> generate the Prisma client and compile the app
#   runner -> minimal runtime with a non-root user
# ---------------------------------------------------------------------------

FROM node:22-alpine AS base
# OpenSSL is required by Prisma's query engine on Alpine.
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# ---------------------------------------------------------------------------
FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# ---------------------------------------------------------------------------
FROM base AS build
ENV NEXT_TELEMETRY_DISABLED=1
ENV DOCKER_BUILD=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# The build only needs a syntactically valid URL; no database is contacted.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"
ENV BETTER_AUTH_SECRET="build-time-placeholder-secret-value"
RUN npx prisma generate && npm run build

# ---------------------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# The standalone output bundles only the server files actually reachable.
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public

# Migrations, the schema and the Prisma CLI are kept so the entrypoint can run
# `prisma migrate deploy` against the live database on startup.
COPY --from=build --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=build --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=build --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --chown=nextjs:nodejs docker/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["./entrypoint.sh"]
CMD ["node", "server.js"]
