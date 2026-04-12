#!/bin/sh
set -e

echo "=== Klient ==="

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
    echo "$NEXTAUTH_SECRET" > "$SECRET_FILE"
    echo "[ok] Generated new secret (stored in /app/data/.nextauth-secret)"
  fi
fi

# --- Auto-detect NEXTAUTH_URL if not provided ---
if [ -z "$NEXTAUTH_URL" ]; then
  export NEXTAUTH_URL="http://localhost:${PORT:-3000}"
  echo "[ok] NEXTAUTH_URL defaulting to $NEXTAUTH_URL"
fi

# --- Run database migrations ---
echo "[..] Running migrations..."
npx prisma migrate deploy --schema=./prisma/schema.prisma 2>&1 || {
  echo "[!!] Migration failed — trying fresh database..."
  npx prisma db push --schema=./prisma/schema.prisma --accept-data-loss 2>&1
}

# --- Seed default admin user if needed ---
echo "[..] Checking seed..."
node prisma/seed.js 2>/dev/null || echo "[ok] Seed skipped (already done)"

# --- Start the app ---
echo "[ok] Starting Klient on port ${PORT:-3000}"
exec node server.js
