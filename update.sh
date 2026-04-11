#!/bin/bash
# Klient — Update script
# Run: bash update.sh

set -e

INSTALL_DIR="/mnt/user/appdata/klient"

echo ""
echo "🔄 Updating Klient..."
cd "$INSTALL_DIR"

echo "📦 Pulling latest changes..."
git pull

echo "🐳 Rebuilding containers..."
docker compose down
docker compose up -d --build

echo ""
echo "✅ Klient updated successfully!"
echo ""
