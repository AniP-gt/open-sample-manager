#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
cd "$PROJECT_DIR"

FAILED_COMMAND=""

on_error() {
  local exit_code=$?
  if [ -n "$FAILED_COMMAND" ]; then
    printf '\n[quality-gate] Failed: %s\n' "$FAILED_COMMAND" >&2
  fi
  printf '[quality-gate] Tests or checks failed. Fix the code or tests, then rerun before proceeding.\n' >&2
  exit "$exit_code"
}

trap on_error ERR

run_step() {
  local label="$1"
  shift
  FAILED_COMMAND="$*"
  printf '\n[quality-gate] %s\n' "$label"
  "$@"
  FAILED_COMMAND=""
}

has_npm_script() {
  local package_json="$1"
  local script_name="$2"
  node -e '
    const fs = require("fs");
    const pkg = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
    process.exit(pkg.scripts && pkg.scripts[process.argv[2]] ? 0 : 1);
  ' "$package_json" "$script_name" >/dev/null 2>&1
}

run_optional_ts_format() {
  if has_npm_script "ui/package.json" "format"; then
    run_step "TypeScript format" npm run format --prefix ui
  elif [ -x "ui/node_modules/.bin/prettier" ]; then
    run_step "TypeScript format" npm exec --prefix ui -- prettier --write .
  elif [ -x "ui/node_modules/.bin/biome" ]; then
    run_step "TypeScript format" npm exec --prefix ui -- biome format --write .
  else
    printf '\n[quality-gate] TypeScript format skipped: no ui format script, Prettier, or Biome is configured.\n'
  fi
}

run_optional_ts_lint() {
  if has_npm_script "ui/package.json" "lint"; then
    run_step "TypeScript lint" npm run lint --prefix ui
  elif [ -x "ui/node_modules/.bin/eslint" ]; then
    run_step "TypeScript lint" npm exec --prefix ui -- eslint .
  elif [ -x "ui/node_modules/.bin/biome" ]; then
    run_step "TypeScript lint" npm exec --prefix ui -- biome lint .
  else
    printf '\n[quality-gate] TypeScript lint uses typecheck: no ui lint script, ESLint, or Biome is configured.\n'
  fi
}

run_step "Rust format" cargo fmt --all
run_step "Rust lint" cargo clippy --workspace --all-targets
run_step "Rust test" cargo test --workspace

run_optional_ts_format
run_optional_ts_lint
run_step "TypeScript typecheck" npm run typecheck --prefix ui
run_step "TypeScript test" npm run test --prefix ui -- --run
run_step "UI build" npm run build --prefix ui

printf '\n[quality-gate] All checks passed.\n'
