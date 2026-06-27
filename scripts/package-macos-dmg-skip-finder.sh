#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
VERSION="$(node -e "const fs=require('fs'); console.log(JSON.parse(fs.readFileSync('$ROOT_DIR/package.json', 'utf8')).version)")"
ARCH="$(uname -m)"

case "$ARCH" in
  arm64) TARGET_ARCH="aarch64" ;;
  x86_64) TARGET_ARCH="x64" ;;
  *) TARGET_ARCH="$ARCH" ;;
esac

BUNDLE_DIR="$ROOT_DIR/src-tauri/target/release/bundle"
MACOS_DIR="$BUNDLE_DIR/macos"
DMG_DIR="$BUNDLE_DIR/dmg"
DMG_SCRIPT="$DMG_DIR/bundle_dmg.sh"
APP_NAME="Prism.app"
DMG_NAME="Prism_${VERSION}_${TARGET_ARCH}.dmg"

if [[ ! -x "$DMG_SCRIPT" ]]; then
  echo "Missing generated DMG script: $DMG_SCRIPT" >&2
  echo "Run 'npm run tauri -- build --bundles app' first." >&2
  exit 1
fi

if [[ ! -d "$MACOS_DIR/$APP_NAME" ]]; then
  echo "Missing app bundle: $MACOS_DIR/$APP_NAME" >&2
  echo "Run 'npm run tauri -- build --bundles app' first." >&2
  exit 1
fi

node "$ROOT_DIR/scripts/patch-macos-document-icons.mjs" "$MACOS_DIR/$APP_NAME"

rm -f "$MACOS_DIR/$DMG_NAME" "$MACOS_DIR"/rw.*."$DMG_NAME"

(
  cd "$MACOS_DIR"
  "$DMG_SCRIPT" \
    --skip-jenkins \
    --volname Prism \
    --icon "$APP_NAME" 180 170 \
    --app-drop-link 480 170 \
    --window-size 660 400 \
    --hide-extension "$APP_NAME" \
    --volicon "$DMG_DIR/icon.icns" \
    "$DMG_NAME" \
    "$APP_NAME"
)

echo "Created $MACOS_DIR/$DMG_NAME"
