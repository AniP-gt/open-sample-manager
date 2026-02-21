#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

require_cmd() {
  local cmd="$1"
  local help_text="$2"
  if ! command -v "${cmd}" >/dev/null 2>&1; then
    echo "[ERROR] Missing command: ${cmd}"
    echo "        ${help_text}"
    exit 1
  fi
}

echo "[INFO] Checking required tools..."
require_cmd rustup "Install Rust via https://rustup.rs/"
require_cmd cargo "Cargo should be available after rustup installation."
require_cmd node "Install Node.js 20 LTS or later."
require_cmd npm "npm ships with Node.js."
require_cmd cmake "Install CMake 3.22 or later."

echo "[INFO] Installing pinned Rust toolchain from rust-toolchain.toml..."
rustup show active-toolchain >/dev/null

echo "[INFO] Installing UI dependencies..."
npm install --prefix "${ROOT_DIR}/ui"

echo "[INFO] Bootstrap completed."
echo "       - Rust check: cargo check --workspace"
echo "       - UI dev server: npm run dev --prefix ui"
echo "       - Plugin configure: cmake -S plugin -B plugin/build -DJUCE_SOURCE_DIR=/path/to/JUCE"
