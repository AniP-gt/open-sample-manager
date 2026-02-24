# TAURI KNOWLEDGE BASE

**Generated:** 2026-02-24T15:43:13+0900
**Commit:** edf68d0
**Branch:** main

## OVERVIEW
Tauri host layer that wraps core Rust APIs as IPC commands and owns app-level runtime concerns (state, plugins, app-data DB path).

## WHERE TO LOOK
| Task | Location | Notes |
|---|---|---|
| IPC command signatures | `src-tauri/src/main.rs` | `#[tauri::command]` functions exported to UI |
| Core error mapping | `src-tauri/src/main.rs` | `ManagerError` -> `CommandError` mapping |
| App startup + state | `src-tauri/src/main.rs` | `setup` sets `samples.db` path under app-data dir |
| Build/link behavior | `src-tauri/Cargo.toml`, `src-tauri/build.rs` | Release profile strips + LTO |
| Runtime permissions | `src-tauri/capabilities/default.json` | Default shell/dialog/fs allowances |
| Packaging/runtime config | `src-tauri/tauri.conf.json` | devUrl 5173, pre-dev/pre-build hooks |

## CONVENTIONS
- Keep the Windows subsystem guard in `src-tauri/src/main.rs:1` unchanged.
- Long-running work (`scan_directory`, `move_sample`) must use `tokio::task::spawn_blocking`.
- Commands should open manager through `open_manager(...)`, not ad-hoc DB connection wiring.
- Emit scan progress via `scan-progress` event contract expected by UI listeners.

## ANTI-PATTERNS
- Do not bypass command wrappers to call core APIs directly from UI; keep IPC contract explicit.
- Do not widen default capabilities without matching UI/plugin use-case.
- Do not introduce blocking CPU/IO work directly on async command threads.

## COMMANDS
```bash
npm run tauri:dev
npm run tauri:build
cargo check -p open-sample-manager
```

## NOTES
- `open-sample-manager-core` is a local path dependency; breaking API changes ripple into IPC and UI typing quickly.
