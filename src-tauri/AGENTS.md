# TAURI KNOWLEDGE BASE

**Generated:** 2026-03-03T06:50:00+0900
**Commit:** 68204da
**Branch:** main

## OVERVIEW
Tauri host layer that wraps core Rust APIs as IPC commands and owns app-level runtime concerns (state, plugins, app-data DB path).

## WHERE TO LOOK
| Task | Location | Notes |
|---|---|---|
| IPC command signatures | `src-tauri/src/main.rs` | `#[tauri::command]` functions exported to UI (~28 commands) |
| Core error mapping | `src-tauri/src/main.rs` | `ManagerError` → `CommandError` mapping |
| App startup + state | `src-tauri/src/main.rs` | `setup` sets `samples.db` path under app-data dir |
| Build/link behavior | `src-tauri/Cargo.toml`, `src-tauri/build.rs` | Release profile: strip=true, lto=true, codegen-units=1, panic=abort |
| Runtime permissions | `src-tauri/capabilities/default.json` | fs allow-read `**`, drag:allow-start-drag, clipboard read/write |
| Packaging/runtime config | `src-tauri/tauri.conf.json` | devUrl **5174**, beforeDevCommand/beforeBuildCommand hooks, macOS minOS 10.13 |

- Keep the Windows subsystem guard in `src-tauri/src/main.rs:1` unchanged.
- Long-running work (`scan_directory`, `move_sample`) must use `tokio::task::spawn_blocking`.
- Commands should open manager through `open_manager(...)`, not ad-hoc DB connection wiring.
- Emit scan progress via `scan-progress` event contract expected by UI listeners.
- macOS drag support uses `tauri-plugin-drag` 2.1.0 + `tauri-plugin-dragout` 0.1.1; both required for drag-out behavior.
- Dev port is **5174** (strictPort true in Vite); Tauri devUrl must match exactly.

## ANTI-PATTERNS
- Do not bypass command wrappers to call core APIs directly from UI; keep IPC contract explicit.
- Do not widen default capabilities without matching UI/plugin use-case.
- Do not introduce blocking CPU/IO work directly on async command threads.
- Do not change devUrl port without updating both `src-tauri/tauri.conf.json` and `ui/vite.config.ts`.

## COMMANDS
```bash
npm run tauri:dev
npm run tauri:build
cargo check -p open-sample-manager
```

## NOTES
- `open-sample-manager-core` is a local path dependency; breaking API changes ripple into IPC and UI typing quickly.
- CSP is null in tauri.conf.json for dev flexibility — review before any production hardening.
- Shell plugin has `open: true` (allows opening URLs/paths); scope carefully if extending.
