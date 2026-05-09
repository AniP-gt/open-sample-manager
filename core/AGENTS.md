# CORE KNOWLEDGE BASE

**Generated:** 2026-05-09T22:22:11+0900
**Commit:** a14778f
**Branch:** main

## OVERVIEW
Rust crate for audio/MIDI scanning, DSP analysis, SQLite persistence, embedding search, and C FFI. `SampleManager` is the boundary consumed by Tauri and FFI.

## STRUCTURE
```text
core/
|- src/analysis/   # DSP + MIDI parsing; see analysis/AGENTS.md
|- src/db/         # schema, migrations, CRUD, FTS5, embedding search
|- src/ffi/        # C ABI handle/string lifecycle
|- src/manager/    # SampleManager facade split by domain
|- src/scanner/    # file discovery + incremental scan helpers
|- src/threading/  # rayon analysis pool + DB writer thread
|- src/embedding/  # 64-dim RMS placeholder embedder
`- tests/          # integration tests + audio/MIDI fixtures
```

## WHERE TO LOOK
| Task | Location | Notes |
|---|---|---|
| Public facade | `src/manager/mod.rs` | `SampleManager`, `ManagerError`, progress types |
| Audio analyze/store | `src/manager/analyze.rs`, `src/manager/scan.rs` | Decode, classify, transaction, progress |
| MIDI workflow | `src/manager/midi.rs`, `src/analysis/midi.rs` | Scan MIDI files and persist metadata |
| DB schema | `src/db/schema.rs` | WAL, FTS5 tables, migrations, seeds |
| DB operations | `src/db/operations/` | `samples.rs` is hotspot; see db/AGENTS.md |
| FFI | `src/ffi/handle.rs`, `src/ffi/functions.rs` | Opaque handles, JSON strings, panic guards |
| Scanner | `src/scanner/mod.rs` | Audio/MIDI extension filters + mtime-based incremental scan |
| Thread pool | `src/threading/mod.rs` | Rayon workers, crossbeam DB writer, WAL checkpoint |
| Integration tests | `tests/*.rs`, `tests/fixtures/` | Pipeline and manager behavior |

## CONVENTIONS
- Re-export public modules and key types from `src/lib.rs`.
- Keep outer layers behind `SampleManager`; Tauri and FFI should not wire DB calls directly.
- DB defaults preserve classification fields: playback `oneshot`, instrument `other`.
- `unsafe` stays inside `src/ffi/`; regular core modules stay safe Rust.
- DSP modules may use targeted clippy cast suppressions for f32/i64 math.
- Tests commonly use in-memory SQLite and `tempfile::TempDir`.

## ANTI-PATTERNS
- Do not bypass migration-safe schema updates in `run_migrations`.
- Do not assume embeddings are indexed or fixed beyond the stored blob dimension check.
- Do not unwrap in production decode/manager paths; tests may use `unwrap`.
- Do not introduce new C ABI ownership rules without updating `src/ffi/AGENTS.md` and tests.
- Do not add new audio formats without updating `core/Cargo.toml` symphonia features and scanner extension logic.

## COMMANDS
```bash
cargo check --workspace
cargo test --workspace
cargo test -p open-sample-manager-core
```

## NOTES
- `src/db/operations/samples.rs`, `src/manager/mod.rs`, and Tauri command wrappers are high-change coupling points.
- Fixture WAVs are committed under `core/tests/fixtures/`; docs there mention generation source.
- Crate type is `['cdylib', 'rlib']`; maintain both FFI and Rust linkage compatibility.
- `core/src/threading/mod.rs` checkpoints WAL with `PRAGMA wal_checkpoint(TRUNCATE)` before writer shutdown.
