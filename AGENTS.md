# PROJECT KNOWLEDGE BASE

**Generated:** 2026-05-09T22:22:11+0900
**Commit:** a14778f
**Branch:** main

## OVERVIEW
Local-first desktop sample manager: Rust analysis/database core, Tauri IPC host, React/Vite UI, and inactive JUCE plugin scaffold. Handles audio samples plus MIDI files, tags, TiMidity++ playback, drag-out, fuzzy UI search, and SQLite/FTS persistence.

## STRUCTURE
```text
open-sample-manager/
|- core/        # Rust library: analysis, scanning, DB, FFI, manager facade
|- src-tauri/   # Tauri app shell and all IPC command wrappers
|- ui/          # React + TypeScript frontend; standalone npm package
|- plugin/      # JUCE CMake scaffold only until JUCE_SOURCE_DIR is set
|- scripts/     # Bootstrap and manual verification scripts
`- docs/        # Design notes, task plans, review-cycle outputs
```

## WHERE TO LOOK
| Task | Location | Notes |
|---|---|---|
| Core API boundary | `core/src/manager/` | `SampleManager`; scan/analyze/search/sample+MIDI facade |
| DB schema + migrations | `core/src/db/schema.rs` | WAL, FTS5, migrations, seed data |
| DB query/update semantics | `core/src/db/operations/` | Samples, MIDI, tags, FTS escaping, embedding search |
| DSP + MIDI analysis | `core/src/analysis/` | Decode, BPM, onset, kick, loop, key, MIDI parse |
| FFI contracts | `core/src/ffi/` | Opaque handle lifecycle + C JSON/string ownership |
| Tauri command boundary | `src-tauri/src/main.rs` | 41 commands, app state, plugins, TiMidity++ process control |
| UI app composition | `ui/src/App.tsx` | Hook wiring + layout; keep business logic in hooks |
| UI domain state | `ui/src/hooks/` | Sample, MIDI, scan/import, and UI state hooks |
| UI list hotspots | `ui/src/components/SampleList/`, `ui/src/components/MidiList/` | Virtualized tables, drag-out, sorting, keyboard navigation |
| UI utilities | `ui/src/utils/` | Pure search/import/path/cache/mapping helpers |
| Test setup | `core/tests/`, `ui/src/__test__/`, `ui/src/**/__test__/` | Cargo + Vitest/jsdom |
| Docs workflow | `docs/AGENTS.md` | Task files, review cycles, issue review iterations |

## CODE MAP
| Symbol | Type | Location | Refs | Role |
|---|---|---|---|---|
| `SampleManager` | struct | `core/src/manager/mod.rs` | high | Public core facade for Tauri and FFI |
| `scan_with_progress` | fn | `core/src/manager/scan.rs` | medium | Parallel audio analysis + transaction + progress events |
| `search_by_embedding` | fn | `core/src/db/operations/samples.rs` | medium | Brute-force cosine search over embedding blobs |
| `init_database` | fn | `core/src/db/schema.rs` | high | Schema bootstrap, migrations, seed data |
| `row_to_sample` | fn | `core/src/db/operations/samples.rs` | high | DB row normalization into `SampleRow` |
| `sm_init` / `sm_free` | FFI | `core/src/ffi/handle.rs` | medium | Opaque handle ownership and double-free guard |
| `scan_directory` | Tauri command | `src-tauri/src/main.rs` | high | UI-triggered long-running sample scan |
| `scan_midi_directory` | Tauri command | `src-tauri/src/main.rs` | medium | UI-triggered MIDI scan |
| `play_midi` | Tauri command | `src-tauri/src/main.rs` | medium | TiMidity++ process start/replace |
| `App` | React component | `ui/src/App.tsx` | high | Hook composition and top-level rendering |
| `useSampleState` | hook | `ui/src/hooks/useSampleState.ts` | high | Sample IPC, pagination, classification, trash flow |
| `useMidiState` | hook | `ui/src/hooks/useMidiState.ts` | high | MIDI list/search/tags/playback state |
| `matchesFuzzySearch` | fn | `ui/src/utils/search.ts` | medium | NFKC multi-term subsequence search for lists |

## CONVENTIONS
- Root npm scripts delegate to `ui`; Rust uses workspace members `core` and `src-tauri`.
- UI build runs TypeScript checks before Vite (`npm run build --prefix ui`).
- Vite and Tauri dev URL are locked to port `5174`; keep both configs in sync.
- Tauri long-running commands use `tokio::task::spawn_blocking` and map core errors to `CommandError`.
- Rust public surface routes through `core/src/lib.rs`, `SampleManager`, then Tauri commands.
- UI backend rows are manually normalized; no generated Tauri types.
- UI components use one-folder-per-component, inline style objects, and barrel exports from `ui/src/components/index.ts`.
- Zustand stores persist settings/favorites/recent IDs under `osm_settings`, `osm-favorites`, and `osm-recent`.

## ANTI-PATTERNS (THIS PROJECT)
- Do not remove the Windows subsystem guard in `src-tauri/src/main.rs:1`.
- Do not call FFI free/string APIs with foreign pointers; only free values created by this library.
- Do not widen Tauri capabilities in `src-tauri/capabilities/default.json` without a matching UI/plugin need.
- Do not change port `5174` without updating both `src-tauri/tauri.conf.json` and `ui/vite.config.ts`.
- Do not bypass explicit backend-to-UI mapping in classification, MIDI, or search flows.
- Do not assume embedding search is indexed; it is O(N) over stored blobs.
- Do not add production `unsafe` outside `core/src/ffi/`.
- Do not move business logic back into `ui/src/App.tsx`; use domain hooks or utilities.
- Do not remove Vite's `src-tauri` watch ignore rule.

## UNIQUE STYLES
- Hybrid monorepo, not JS-workspace-based: root npm wraps Tauri CLI, `ui/` owns its package lock.
- Plugin target is scaffold-only; no JUCE `Source/` implementation exists yet.
- Sample and MIDI lists are intentionally dense desktop tables with virtualization, column resizing, drag-out, keyboard navigation, and copy/open-folder actions.
- Search UX combines backend FTS for sample rows with frontend fuzzy subsequence filtering in virtualized lists.

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
cmake -S plugin -B plugin/build -DJUCE_SOURCE_DIR=/path/to/JUCE
```

## NOTES
- No `.github/workflows` or release automation is present; builds are manual.
- `src-tauri/capabilities/default.json` currently allows fs read `**`, drag start, and clipboard read/write.
- Release builds configure `strip=true`, `lto=true`, `codegen-units=1`, `panic=abort` in `src-tauri/Cargo.toml`.
- TiMidity++ is required for MIDI playback; Tauri searches common macOS/Linux/Windows install paths plus `PATH`.
- Current working tree has user changes in code files; avoid broad refactors during focused work.
