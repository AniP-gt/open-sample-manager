# CORE KNOWLEDGE BASE

**Generated:** 2026-02-24T15:43:13+0900
**Commit:** edf68d0
**Branch:** main

## OVERVIEW
Rust crate for scanning audio files, running DSP analysis, persisting metadata in SQLite, and exposing FFI-safe entry points.

## STRUCTURE
```text
core/
|- src/analysis/   # BPM, onset, kick, loop classification, decoding
|- src/db/         # schema + CRUD + FTS5 + embedding search
|- src/ffi/        # C ABI boundary (handle lifecycle + string ownership)
|- src/manager.rs  # orchestration layer used by Tauri commands
|- src/threading/  # rayon + channel-based analysis pool
|- src/embedding/  # 64-dim placeholder embedder
`- tests/          # integration tests + audio fixtures
```

## WHERE TO LOOK
| Task | Location | Notes |
|---|---|---|
| End-to-end workflow | `core/src/manager.rs` | Primary API used by `src-tauri` |
| SQL schema + migrations | `core/src/db/schema.rs` | Adds classification columns via migration |
| Query + update semantics | `core/src/db/operations.rs` | FTS escaping, COALESCE update rules |
| DSP behaviors | `core/src/analysis/*.rs` | Decode -> onset/FFT -> BPM/kick/loop |
| Threaded persistence | `core/src/threading/mod.rs` | Writer thread + WAL checkpoint |
| C integration contracts | `core/src/ffi/handle.rs`, `core/src/ffi/functions.rs` | Null-safe C API + explicit free |

## CONVENTIONS
- Keep public surface re-exported through `core/src/lib.rs`.
- Preserve `SampleManager` as orchestration boundary; avoid direct cross-module calls from outer layers.
- Persist classification fields with explicit fallback defaults (`oneshot`, `other`) at DB layer.
- FFI functions return sentinel values (`-1` or null) instead of panicking; caller owns returned C strings.

## ANTI-PATTERNS
- Do not pass externally-created pointers to `sm_free` or other handle APIs.
- Do not bypass migration-safe schema updates in `run_migrations`.
- Do not assume embedding search is indexed; it is O(N) brute-force over stored blobs.

## COMMANDS
```bash
cargo check --workspace
cargo test --workspace
cargo test -p open-sample-manager-core
```

## NOTES
- `core/src/db/operations.rs` and `core/src/manager.rs` are high-change hotspots; keep edits surgical.
- Integration fixtures in `core/tests/fixtures/` are used for end-to-end pipeline assertions.
