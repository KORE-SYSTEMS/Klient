#!/bin/bash
# Klient — Manual update script (alternative to in-app updates)
# Run: bash update.sh

set -e

INSTALL_DIR="/mnt/user/appdata/Klient"

echo ""
echo "Updating Klient..."
cd "$INSTALL_DIR"

echo "Pulling latest changes..."
git pull origin main

echo "Rebuilding containers..."
docker compose up -d --build --no-deps app

echo ""
echo "Klient updated successfully!"
echo "Current version: $(grep '"version"' package.json | head -1 | awk -F'"' '{print $4}')"
echo ""
