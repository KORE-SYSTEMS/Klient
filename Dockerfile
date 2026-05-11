FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# ---- Install dependencies ----
FROM base AS deps
COPY package.json package-lock.json* ./
COPY prisma/schema.prisma ./prisma/schema.prisma
# Puppeteer bundelt Chromium per Default — wir nutzen aber das System-Chromium
# von Alpine im Runner-Stage. Spart ~300MB Image-Größe und vermeidet Alpine-
# Inkompatibilität der vorgebauten Chromium-Binary von Google.
ENV PUPPETEER_SKIP_DOWNLOAD=true
# npm ci ensures exact versions from lockfile
RUN npm ci --legacy-peer-deps

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
# chromium + Fonts + libs für PDF-Generierung via Puppeteer
RUN apk add --no-cache \
    su-exec \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    font-noto \
    font-noto-emoji

# Puppeteer soll die System-Chromium-Binary nutzen statt versuchen
# selbst eine herunterzuladen.
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built Next.js standalone app
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Komplette node_modules aus dem Builder kopieren.
# Beinhaltet:
#   - Prisma CLI + Client + Engines (für db push + Runtime)
#   - bcryptjs (für Seed + Auth)
#   - Puppeteer + alle transitiven Deps (dynamic import in PDF-Route wird vom
#     Next.js Standalone-Tracer nicht erkannt → explizit nötig)
#   - Alle anderen Runtime-Deps
# Chromium-Binary wird NICHT mitgezogen (PUPPETEER_SKIP_DOWNLOAD im deps-Stage)
# — Wir nutzen die System-Chromium via PUPPETEER_EXECUTABLE_PATH.
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules

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
