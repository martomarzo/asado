#!/usr/bin/env bash
# Auto-deploy: pull the latest main and redeploy only what changed.
# Runs on the Docker VM via asado-deploy.timer (systemd) every minute.
# The repo is public, so no credentials are needed to fetch.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$REPO_DIR"

git fetch --quiet origin main
BEFORE="$(git rev-parse HEAD)"
AFTER="$(git rev-parse origin/main)"
[ "$BEFORE" = "$AFTER" ] && exit 0   # nothing new — stay quiet

echo "[asado-deploy] $(date -Is): $BEFORE -> $AFTER"
CHANGED="$(git diff --name-only "$BEFORE" "$AFTER")"
echo "[asado-deploy] changed files:"; echo "$CHANGED" | sed 's/^/  /'

# Move the working tree to the new commit (untracked api/.env is preserved).
git reset --hard --quiet origin/main

# api/ is baked into the image (server.js, schema.sql, Dockerfile, compose, deps),
# so any change there needs a rebuild. web/ is volume-mounted and served live —
# a git pull alone updates it, no rebuild required.
if echo "$CHANGED" | grep -qE '^api/'; then
  echo "[asado-deploy] rebuilding + restarting api container"
  ( cd api && docker compose up -d --build )
fi

# Schema changes: re-apply (idempotent) after the rebuilt image is running.
if echo "$CHANGED" | grep -q '^api/schema\.sql'; then
  echo "[asado-deploy] applying schema migration"
  ( cd api && docker compose exec -T asado-api npm run migrate )
fi

echo "[asado-deploy] done"
