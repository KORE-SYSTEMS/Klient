#!/bin/sh
# Klient Updater — watches for update requests and rebuilds the app
# Runs as a sidecar container with access to docker socket + project dir

set -e

PROJECT_DIR="/project"
FLAG_FILE="/data/.update-requested"
LOG_FILE="/data/.update-log"

echo "=== Klient Updater started ==="
echo "Watching for update requests..."

while true; do
  if [ -f "$FLAG_FILE" ]; then
    echo "$(date): Update requested, starting..." | tee "$LOG_FILE"

    # Remove the flag immediately
    rm -f "$FLAG_FILE"

    cd "$PROJECT_DIR"

    # Pull latest code
    echo "$(date): Pulling latest code..." | tee -a "$LOG_FILE"
    git pull origin main 2>&1 | tee -a "$LOG_FILE"

    # Rebuild and restart the app container only
    echo "$(date): Rebuilding app container..." | tee -a "$LOG_FILE"
    docker compose up -d --build --no-deps app 2>&1 | tee -a "$LOG_FILE"

    echo "$(date): Update complete!" | tee -a "$LOG_FILE"
  fi

  sleep 5
done
