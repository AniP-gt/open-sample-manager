# PROJECT KNOWLEDGE BASE

**Generated:** 2026-02-24T15:43:13+0900
**Commit:** edf68d0
**Branch:** main

## OVERVIEW
Desktop sample manager workspace: Rust audio-analysis core, Tauri host, React/Vite UI, and JUCE plugin scaffold.

## STRUCTURE
```text
open-sample-manager/
|- core/        # Rust library: analysis, scanning, DB, FFI
|- src-tauri/   # Tauri app shell and IPC command layer
|- ui/          # React + TypeScript frontend
|- plugin/      # JUCE CMake scaffold (stub target until JUCE path is set)
|- scripts/     # Bootstrap tooling checks
`- docs/        # Design and feature-tracking notes
```

## WHERE TO LOOK
| Task | Location | Notes |
|---|---|---|
| Core API + orchestration | `core/src/manager.rs` | Scan/analyze/store workflow hub |
| DB schema + SQL | `core/src/db/schema.rs`, `core/src/db/operations.rs` | WAL, FTS5, embedding search |
| DSP analysis | `core/src/analysis/` | BPM, onset, kick, loop classification |
| FFI contracts | `core/src/ffi/` | Opaque handle lifecycle + C JSON bridge |
| Tauri command boundary | `src-tauri/src/main.rs` | `#[tauri::command]` wrappers over core |
| UI state + invoke calls | `ui/src/App.tsx` | Main state graph and backend integration |
| UI components | `ui/src/components/` | Per-component folders, barrel export |
| Dev/bootstrap commands | `README.md`, `scripts/bootstrap.sh` | Canonical setup + run flow |

## CODE MAP
| Symbol | Type | Location | Refs | Role |
|---|---|---|---|---|
| `SampleManager` | struct | `core/src/manager.rs` | high | Core orchestration entry point |
| `search_by_embedding` | fn | `core/src/db/operations.rs` + `src-tauri/src/main.rs` | medium | Semantic similarity boundary |
| `init_database` | fn | `core/src/db/schema.rs` | high | Schema bootstrap + migration gate |
| `scan_directory` | tauri command | `src-tauri/src/main.rs` | high | UI-triggered long-running scan |
| `App` | React component | `ui/src/App.tsx` | high | UI state, filters, IPC wiring |

## CONVENTIONS
- Root scripts delegate to package-specific commands (`npm run ... --prefix ui`, Cargo workspace for Rust).
- UI build script enforces typecheck before Vite build.
- Tauri config pins dev URL/port (`5173`) and ignores `src-tauri` in Vite watch.
- Rust core exports public modules via `core/src/lib.rs`; cross-layer calls should route through manager/command boundaries.

## ANTI-PATTERNS (THIS PROJECT)
- Do not remove Windows subsystem guard line in `src-tauri/src/main.rs:1`.
- Do not call FFI free/init APIs with foreign pointers (`core/src/ffi/handle.rs`).
- Avoid bypassing explicit value mapping between UI and backend payloads in classification/edit flows.

## UNIQUE STYLES
- Monorepo but not JS-workspace-based: Rust workspace + standalone UI package + Tauri wrapper.
- UI components are mostly one-folder/one-file and heavily inline-styled.
- Current plugin target is scaffold-only; production plugin behavior is not implemented yet.

## COMMANDS
```bash
./scripts/bootstrap.sh
npm run tauri:dev
npm run tauri:build
cargo check --workspace
cargo test --workspace
npm run dev --prefix ui
npm run typecheck --prefix ui
npm run test --prefix ui
```

## NOTES
- Project has active user changes in multiple tracked files; avoid broad refactors during focused tasks.
- Security capability defaults live in `src-tauri/capabilities/default.json` and should stay aligned with invoked plugins.
- Embedding search is brute-force O(N) today; treat scale assumptions carefully.
