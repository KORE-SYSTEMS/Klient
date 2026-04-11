#!/bin/bash
# Klient — One-time setup script for Unraid
# Run: bash setup.sh

set -e

INSTALL_DIR="/mnt/user/appdata/klient"

echo ""
echo "╔═══════════════════════════════════╗"
echo "║         KLIENT SETUP              ║"
echo "╚═══════════════════════════════════╝"
echo ""

# Check if already installed
if [ -f "$INSTALL_DIR/.env" ]; then
  echo "⚠️  Klient already installed at $INSTALL_DIR"
  echo "   To reinstall, delete $INSTALL_DIR first."
  exit 1
fi

# Clone repo
echo "📦 Cloning repository..."
mkdir -p "$INSTALL_DIR"
git clone https://github.com/YOUR_USERNAME/klient.git "$INSTALL_DIR"
cd "$INSTALL_DIR"

# Generate secrets
echo ""
echo "🔐 Generating secrets..."
DB_PASSWORD=$(openssl rand -hex 16)
NEXTAUTH_SECRET=$(openssl rand -hex 32)

# Ask for URL
echo ""
read -p "🌐 Enter your URL (e.g. http://192.168.178.59:3200 or https://klient.yourdomain.com): " NEXTAUTH_URL
NEXTAUTH_URL=${NEXTAUTH_URL:-"http://192.168.178.59:3200"}

# Write .env
cat > .env << EOF
DB_PASSWORD=$DB_PASSWORD
DATABASE_URL=postgresql://klient:${DB_PASSWORD}@klient-db:5432/klient
NEXTAUTH_SECRET=$NEXTAUTH_SECRET
NEXTAUTH_URL=$NEXTAUTH_URL
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@klient.local
NODE_ENV=production
EOF

echo ""
echo "✅ .env created"

# Create uploads directory
mkdir -p uploads

# Start containers
echo ""
echo "🐳 Starting Docker containers..."
docker compose up -d --build

echo ""
echo "⏳ Waiting for app to be ready..."
sleep 10

echo ""
echo "╔═══════════════════════════════════╗"
echo "║         SETUP COMPLETE ✓          ║"
echo "╚═══════════════════════════════════╝"
echo ""
echo "  URL:      $NEXTAUTH_URL"
echo "  Email:    admin@klient.local"
echo "  Password: changeme123"
echo ""
echo "  ⚠️  Change the password after first login!"
echo ""
