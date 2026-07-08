# Stage 1: Build the application
FROM node:24-alpine AS builder

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# Copy workspace configs and package.json files first for layer caching
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json ./apps/api/

# postinstall runs `prisma generate`, which needs the schema present already
COPY apps/api/prisma ./apps/api/prisma
COPY apps/api/prisma.config.ts ./apps/api/prisma.config.ts

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# Copy the rest of the source
COPY apps/api ./apps/api

# Build
RUN pnpm --dir apps/api build

# Deploy to a standalone directory (prod deps only) - must use --filter from
# workspace root, "--dir X deploy" does not select a project correctly
RUN pnpm --filter api deploy --prod --legacy /app/out

# -----------------------------------------------------------------
# Stage 2: Production runner
# -----------------------------------------------------------------
FROM node:24-alpine AS runner
WORKDIR /app

RUN apk add --no-cache postgresql-client wget

RUN addgroup -S nodejs && adduser -S nodeuser -G nodejs

ENV NODE_ENV=production

COPY --from=builder --chown=nodeuser:nodejs /app/out ./
COPY --from=builder --chown=nodeuser:nodejs /app/apps/api/dist ./dist

COPY --chown=nodeuser:nodejs entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

USER nodeuser

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-3000}/health || exit 1

EXPOSE 3000

ENTRYPOINT ["/entrypoint.sh"]
