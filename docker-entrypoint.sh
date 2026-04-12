#!/bin/sh
set -e

echo "=== Klient ==="

# --- Fix permissions on mounted volumes (runs as root) ---
chown -R nextjs:nodejs /app/data /app/uploads 2>/dev/null || true
echo "[ok] Permissions set on /app/data and /app/uploads"

# --- Auto-configure DATABASE_URL ---
export DATABASE_URL="${DATABASE_URL:-file:/app/data/klient.db}"

# --- Auto-generate NEXTAUTH_SECRET if not provided ---
if [ -z "$NEXTAUTH_SECRET" ]; then
  SECRET_FILE="/app/data/.nextauth-secret"
  if [ -f "$SECRET_FILE" ]; then
    export NEXTAUTH_SECRET=$(cat "$SECRET_FILE")
    echo "[ok] Using stored secret"
  else
    export NEXTAUTH_SECRET=$(openssl rand -base64 32)
    su-exec nextjs:nodejs sh -c "echo '$NEXTAUTH_SECRET' > '$SECRET_FILE'"
    echo "[ok] Generated new secret (stored in /app/data/.nextauth-secret)"
  fi
fi

# --- Auto-detect NEXTAUTH_URL if not provided ---
if [ -z "$NEXTAUTH_URL" ]; then
  export NEXTAUTH_URL="http://localhost:${PORT:-3000}"
  echo "[ok] NEXTAUTH_URL defaulting to $NEXTAUTH_URL"
fi

# --- Prisma CLI: always use the local copy via node, never npx ---
PRISMA="node ./node_modules/prisma/build/index.js"

# --- Run database migrations ---
echo "[..] Running migrations..."
su-exec nextjs:nodejs $PRISMA migrate deploy --schema=./prisma/schema.prisma 2>&1 || {
  echo "[!!] Migration failed — trying schema push..."
  su-exec nextjs:nodejs $PRISMA db push --schema=./prisma/schema.prisma --accept-data-loss 2>&1
}

# --- Seed default workspace if needed ---
echo "[..] Checking seed..."
su-exec nextjs:nodejs node prisma/seed.js 2>/dev/null || echo "[ok] Seed skipped (already done)"

# --- Start the app as nextjs user ---
echo "[ok] Starting Klient on port ${PORT:-3000}"
exec su-exec nextjs:nodejs node server.js
