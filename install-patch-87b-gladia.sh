#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${1:-/root/ai-financer}"
PATCH_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_DIR/backend"

if [ ! -d "$BACKEND_DIR" ]; then
  echo "Backend dir not found: $BACKEND_DIR" >&2
  echo "Usage: ./install-patch-87b-gladia.sh /root/ai-financer" >&2
  exit 1
fi

backup_dir="$PROJECT_DIR/.patch-backups/patch-87b-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$backup_dir"

copy_file() {
  local rel="$1"
  local src="$PATCH_DIR/$rel"
  local dst="$PROJECT_DIR/$rel"
  if [ -f "$dst" ]; then
    mkdir -p "$backup_dir/$(dirname "$rel")"
    cp "$dst" "$backup_dir/$rel"
  fi
  mkdir -p "$(dirname "$dst")"
  cp "$src" "$dst"
  echo "replaced: $rel"
}

copy_file "backend/package.json"
copy_file "backend/package-lock.json"
copy_file "backend/src/services/voice.service.ts"
copy_file "backend/src/controllers/voice.controller.ts"
copy_file "backend/scripts/run-voice-stt-smoke.mjs"
copy_file "docs/VOICE_STT_GLADIA_PATCH_87.md"

echo
cd "$BACKEND_DIR"
echo "Checking OpenAI references in backend src/package files..."
if grep -R "openai\|OpenAI\|OPENAI" -n src package.json package-lock.json; then
  echo "ERROR: OpenAI references still found after replacement." >&2
  echo "Check if the project has another backend path or generated dist files are being searched." >&2
  exit 2
else
  echo "OK: no OpenAI references in backend src/package files."
fi

echo
if grep -q '^GLADIA_API_KEY=' .env 2>/dev/null; then
  echo "OK: GLADIA_API_KEY exists in backend/.env"
else
  echo "WARNING: backend/.env does not contain GLADIA_API_KEY=" >&2
  echo "Add it before restart:" >&2
  echo "  GLADIA_API_KEY=your_key" >&2
fi

if grep -q '^VOICE_STT_PROVIDER=gladia' .env 2>/dev/null; then
  echo "OK: VOICE_STT_PROVIDER=gladia exists in backend/.env"
else
  echo "WARNING: backend/.env should contain VOICE_STT_PROVIDER=gladia" >&2
fi

echo
echo "Backup saved to: $backup_dir"
echo "Next commands:"
echo "  cd $BACKEND_DIR"
echo "  npm install"
echo "  npm run build"
echo "  pm2 restart ai-financer --update-env"
