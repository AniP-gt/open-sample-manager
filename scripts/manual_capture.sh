#!/usr/bin/env bash
# Capture a screenshot of the app window using macOS screencapture
# Saves to .local/manual-verify/<timestamp>.png

set -euo pipefail

OUT_DIR=".local/manual-verify"
mkdir -p "$OUT_DIR"
TS=$(date +%Y%m%d_%H%M%S)
OUT_FILE="$OUT_DIR/overlay_capture_$TS.png"

echo "Starting interactive screenshot capture. When the crosshair appears, click the app window or drag to select the area to capture."
echo "Screenshot will be saved to: $OUT_FILE"

# -i interactive selection. If run in CI/headless, this will hang; intended for local desktop use.
screencapture -i "$OUT_FILE"

echo "Saved screenshot: $OUT_FILE"

exit 0
