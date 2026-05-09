# TAURI KNOWLEDGE BASE

**Generated:** 2026-05-09T22:22:11+0900
**Commit:** a14778f
**Branch:** main

## OVERVIEW
Tauri host layer. Owns app startup, plugins, app-data DB path, IPC commands, drag-out helpers, clipboard/open-folder utilities, and TiMidity++ MIDI process control.

## WHERE TO LOOK
| Task | Location | Notes |
|---|---|---|
| IPC command signatures | `src/main.rs` | 41 `#[tauri::command]` functions |
| App startup + state | `src/main.rs` | `setup` creates `samples.db` in app data; `AppState` stores manager + TiMidity PID |
| Progress events | `src/main.rs` | `scan-progress` emitted from scan/re-scan closures |
| Long work wrappers | `src/main.rs` | `spawn_blocking` around scan, re-scan, trash, drag prep, move, MIDI scan |
| Error mapping | `src/main.rs` | `ManagerError` -> `CommandError { code, message, details }` |
| TiMidity++ | `src/main.rs` | detection paths, install hints, play/stop process handling |
| Runtime permissions | `capabilities/default.json` | fs read `**`, drag start, clipboard read/write |
| Packaging config | `tauri.conf.json` | devUrl 5174, npm hooks, asset scope, shell open |
| Build behavior | `Cargo.toml`, `build.rs` | release profile and Tauri build script |

## CONVENTIONS
- Keep the Windows subsystem guard at `src/main.rs:1` unchanged.
- Commands open core through managed `Arc<Mutex<SampleManager>>`; no ad-hoc DB connections here.
- Long-running CPU/IO work uses `tokio::task::spawn_blocking` before touching `SampleManager` or filesystem-heavy operations.
- Scan progress payload shape mirrors UI `ScanProgress` expectations: stage/current/total/currentFile.
- macOS drag-out needs both `tauri-plugin-dragout` and `tauri-plugin-drag` registered.
- Port `5174` must match `ui/vite.config.ts` strictPort.

## ANTI-PATTERNS
- Do not widen default capabilities without a concrete UI/plugin use case.
- Do not block async command threads directly.
- Do not change devUrl or beforeDev/beforeBuild commands without updating UI scripts/config.
- Do not bypass IPC wrappers from UI; keep command names and payload mapping explicit.
- Do not leave multiple TiMidity++ processes running; `play_midi` kills the previous PID first.

## COMMANDS
```bash
npm run tauri:dev
npm run tauri:build
cargo check -p open-sample-manager
cargo test -p open-sample-manager
```

## NOTES
- `open-sample-manager-core` is a path dependency; breaking manager APIs ripple into command payloads and UI hooks.
- CSP is `null` in `tauri.conf.json`; review before production hardening.
- Shell plugin has `open: true`; scope carefully if extending URL/path opening.
- No CI workflow exists; Tauri build verification is manual.
