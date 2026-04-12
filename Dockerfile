FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# ---- Install dependencies ----
FROM base AS deps
COPY package.json package-lock.json* ./
COPY prisma/schema.prisma ./prisma/schema.prisma
# npm ci ensures exact versions from lockfile — no version drift
RUN npm ci

# ---- Build ----
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Version injected from GitHub Actions (git tag), falls back to package.json
ARG APP_VERSION
RUN if [ -n "$APP_VERSION" ]; then echo "$APP_VERSION" > VERSION; fi
# Use local prisma binary via node — never npx (which can pull a different version)
RUN node ./node_modules/prisma/build/index.js generate
RUN npm run build

# ---- Production runner ----
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="file:/app/data/klient.db"

# su-exec for dropping privileges (root → nextjs) after permission fix
RUN apk add --no-cache su-exec

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built Next.js standalone app
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma runtime (client + engines + CLI for migrate deploy)
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

# Copy bcryptjs (needed for seed + auth at runtime)
COPY --from=builder /app/node_modules/bcryptjs ./node_modules/bcryptjs

# Copy prisma schema + migrations + seed for runtime migrate deploy
COPY --from=builder /app/prisma ./prisma

# Copy VERSION file if it was created from git tag
COPY --from=builder /app/VERSION* ./

# Create data & uploads directories
RUN mkdir -p /app/data /app/uploads

# Entrypoint runs as root to fix permissions, then drops to nextjs
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Run as root — entrypoint handles permission fix + privilege drop
ENTRYPOINT ["./docker-entrypoint.sh"]
