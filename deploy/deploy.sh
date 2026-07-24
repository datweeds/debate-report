#!/bin/bash
# Run this on the Contabo server to deploy or update debate-report.
# First run: sets up PM2 and builds.
# Subsequent runs: pulls latest, rebuilds, restarts.

set -e

APP_DIR="/home/david/debate-report"

echo "==> Pulling latest code..."
cd "$APP_DIR"
git pull origin main

echo "==> Installing dependencies..."
npm ci --omit=dev

echo "==> Building..."
npm run build

echo "==> Restarting PM2..."
# Start if not running, restart if already running
npx pm2 describe debate-report > /dev/null 2>&1 \
  && npx pm2 restart debate-report \
  || npx pm2 start ecosystem.config.cjs

npx pm2 save

echo "==> Done. debate-report is running on port 3004."
