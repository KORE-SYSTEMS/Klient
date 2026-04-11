#!/bin/sh
set -e

echo "=== Klient Starting ==="
echo "Running database migrations..."
npx prisma migrate deploy

echo "Seeding database (skipped if already seeded)..."
node prisma/seed.js 2>/dev/null || echo "Seed skipped (already done or no seed script)"

echo "Starting application..."
exec node server.js
