#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
YES=0
CHECK_ONLY=0
SKIP_BUILD=0

usage() {
  cat <<'USAGE'
Open Sample Manager installer for macOS/Linux/Git Bash.

Usage:
  ./install.sh [--yes] [--check-only] [--skip-build]

Options:
  --yes         Install missing packages when a supported package manager is available.
  --check-only  Only check tools and print missing items.
  --skip-build  Install dependencies but skip the final production build.
USAGE
}

log() {
  printf '[INFO] %s\n' "$1"
}

warn() {
  printf '[WARN] %s\n' "$1"
}

fail() {
  printf '[ERROR] %s\n' "$1" >&2
  exit 1
}

for arg in "$@"; do
  case "$arg" in
    --yes|-y) YES=1 ;;
    --check-only) CHECK_ONLY=1 ;;
    --skip-build) SKIP_BUILD=1 ;;
    --help|-h) usage; exit 0 ;;
    *) fail "Unknown option: $arg" ;;
  esac
done

has_cmd() {
  command -v "$1" >/dev/null 2>&1
}

run_or_print() {
  local -a command_parts=("$@")
  if [ "$CHECK_ONLY" -eq 1 ]; then
    printf '       %q' "${command_parts[@]}"
    printf '\n'
    return 0
  fi
  "${command_parts[@]}"
}

install_with_brew() {
  local package_name="$1"
  if ! has_cmd brew; then
    warn "Homebrew is required to install $package_name automatically. Install Homebrew from https://brew.sh/ and rerun this script."
    return 1
  fi

  if [ "$YES" -ne 1 ]; then
    warn "Missing $package_name. Rerun with --yes to install it with Homebrew, or run: brew install $package_name"
    return 1
  fi

  run_or_print brew install "$package_name"
}

version_at_least() {
  local current="$1"
  local required="$2"
  awk -v current="$current" -v required="$required" '
    BEGIN {
      split(current, c, "."); split(required, r, ".");
      for (i = 1; i <= 3; i++) {
        c[i] += 0; r[i] += 0;
        if (c[i] > r[i]) exit 0;
        if (c[i] < r[i]) exit 1;
      }
      exit 0;
    }
  '
}

check_versions() {
  local node_version
  node_version="$(node --version | sed 's/^v//')"
  if ! version_at_least "$node_version" "20.0.0"; then
    fail "Node.js 20 LTS or later is required. Current version: $node_version"
  fi

  local cmake_version
  cmake_version="$(cmake --version | awk 'NR == 1 { print $3 }')"
  if ! version_at_least "$cmake_version" "3.22.0"; then
    fail "CMake 3.22 or later is required. Current version: $cmake_version"
  fi
}

ensure_macos_tooling() {
  if ! xcode-select -p >/dev/null 2>&1; then
    warn "Xcode Command Line Tools are required. macOS will show an installer dialog."
    if [ "$CHECK_ONLY" -eq 0 ]; then
      xcode-select --install || true
      fail "Finish the Xcode Command Line Tools installer, then rerun ./install.sh"
    fi
  fi

  if ! has_cmd brew; then
    if [ "$YES" -eq 1 ] && [ "$CHECK_ONLY" -eq 0 ]; then
      log "Installing Homebrew..."
      /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
      if [ -x /opt/homebrew/bin/brew ]; then
        eval "$(/opt/homebrew/bin/brew shellenv)"
      elif [ -x /usr/local/bin/brew ]; then
        eval "$(/usr/local/bin/brew shellenv)"
      fi
    else
      warn "Homebrew is missing. Install it from https://brew.sh/ or rerun with --yes."
    fi
  fi

  has_cmd rustup || install_with_brew rustup-init || true
  if ! has_cmd rustup && has_cmd rustup-init && [ "$CHECK_ONLY" -eq 0 ]; then
    rustup-init -y
    export PATH="$HOME/.cargo/bin:$PATH"
  fi

  has_cmd node || install_with_brew node || true
  has_cmd cmake || install_with_brew cmake || true
  has_cmd timidity || install_with_brew timidity || true
}

ensure_linux_tooling() {
  warn "Linux system packages differ by distribution. This script checks tools and installs project dependencies only."
  if ! has_cmd rustup; then
    warn "Install Rust: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
  fi
  if ! has_cmd node; then
    warn "Install Node.js 20 LTS or later from https://nodejs.org/"
  fi
  if ! has_cmd cmake; then
    warn "Install CMake 3.22 or later with your distro package manager."
  fi
  if ! has_cmd timidity; then
    warn "Install TiMidity++ with your distro package manager, for example: sudo apt-get install timidity timidity-daemon freepats"
  fi
}

ensure_git_bash_tooling() {
  warn "Windows users should prefer PowerShell: powershell -ExecutionPolicy Bypass -File .\\install.ps1 -Yes"
  if ! has_cmd rustup || ! has_cmd node || ! has_cmd npm || ! has_cmd cmake; then
    fail "Missing Windows build tools. Run install.ps1 from PowerShell, then rerun this script if needed."
  fi
}

ensure_required_commands() {
  local missing=0
  for cmd in rustup cargo node npm cmake; do
    if has_cmd "$cmd"; then
      log "Found $cmd"
    else
      warn "Missing $cmd"
      missing=1
    fi
  done

  if has_cmd timidity; then
    log "Found TiMidity++ for MIDI playback"
  else
    warn "TiMidity++ is missing. The app can build, but MIDI playback will need TiMidity++ and a soundfont."
  fi

  if [ "$missing" -ne 0 ]; then
    fail "Required build tools are still missing. Install them and rerun ./install.sh"
  fi
}

case "$(uname -s)" in
  Darwin) ensure_macos_tooling ;;
  Linux) ensure_linux_tooling ;;
  MINGW*|MSYS*|CYGWIN*) ensure_git_bash_tooling ;;
  *) fail "Unsupported OS: $(uname -s)" ;;
esac

ensure_required_commands
check_versions

if [ "$CHECK_ONLY" -eq 1 ]; then
  log "Check complete. No project dependencies were installed."
  exit 0
fi

log "Installing Rust toolchain from rust-toolchain.toml..."
rustup show active-toolchain >/dev/null

log "Installing root npm dependencies..."
npm install --prefix "$ROOT_DIR"

log "Installing UI npm dependencies..."
npm install --prefix "$ROOT_DIR/ui"

log "Checking Rust workspace..."
cargo check --workspace

log "Checking UI types..."
npm run typecheck --prefix "$ROOT_DIR/ui"

if [ "$SKIP_BUILD" -eq 0 ]; then
  log "Building desktop app package..."
  npm run build:app --prefix "$ROOT_DIR"
fi

log "Install finished."
log "Development: npm run tauri:dev"
log "Production build: npm run build:app"
