#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-/root/ai-financer}"

cd "$ROOT/backend"
if [ -f /root/ai-financer-secrets/backend.env ]; then
  set -a
  . /root/ai-financer-secrets/backend.env
  set +a
fi

echo "=== Backend release check ==="
npm run release:check

echo "=== Backend AI launch checks ==="
npm run test:ai-launch

echo "=== Frontend predeploy full ==="
cd "$ROOT/frontend"
npm run audit:css
npm run audit:predeploy:strict
npm run build

echo "=== Server pre-ad check finished ==="
