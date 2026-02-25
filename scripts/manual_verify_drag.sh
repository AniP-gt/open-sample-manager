#!/usr/bin/env bash
# Manual verification helper for drag-and-drop import
# Usage: chmod +x scripts/manual_verify_drag.sh && ./scripts/manual_verify_drag.sh

set -euo pipefail

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
UI_DIR="$ROOT_DIR/ui"
OUT_DIR="$ROOT_DIR/.local/manual-verify"
mkdir -p "$OUT_DIR"

echo "Manual drag/drop verification helper"
echo "This script will:"
echo " 1) Start the Tauri dev flow (you may run it yourself if you prefer)"
echo " 2) Tail the UI logs output to a file under $OUT_DIR"
echo " 3) Offer a simple macOS screenshot command you can run while dragging"

echo
echo "NOTE: This script does not simulate OS-level drag/drop. You must drag files/folders from Finder (macOS) or Explorer (Windows) into the running app window while it is visible. The app will print debug lines to the terminal which will be captured in $OUT_DIR/renderer.log"

read -p "Start tauri dev now from this script? (y/N) " start
if [[ "$start" =~ ^([yY][eE][sS]|[yY])$ ]]; then
  echo "Starting tauri dev (UI + backend). Logs will be written to $OUT_DIR/renderer.log"
  (cd "$UI_DIR" && npm run tauri:dev) 2>&1 | tee "$OUT_DIR/renderer.log" &
  TAURI_PID=$!
  echo "Tauri dev started (PID: $TAURI_PID). Wait for the dev server and then perform the drag/drop in the app window." 
else
  echo "Skipping automatic tauri dev start. You can start it manually with: npm run tauri:dev"
fi

echo
echo "When you are ready to capture a screenshot of the drag overlay:"
echo " - macOS: run the following command while dragging the files into the app window (press Enter to print the command):"
echo
echo "   screencapture -i -x '$OUT_DIR/import-overlay-$(date +%s).png'"
echo
echo "This uses macOS interactive screenshot mode (-i). The -x flag avoids camera shutter sound. Save the image and attach it to the PR or paste where requested."

echo
echo "When you're done, you can stop the dev server with: kill $TAURI_PID (if started by this script) or close the terminal where it runs."

echo
echo "Saved logs and screenshots will be placed under: $OUT_DIR"
