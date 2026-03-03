# CORE KNOWLEDGE BASE

**Generated:** 2026-03-03T06:50:00+0900
**Commit:** 68204da
**Branch:** main

## OVERVIEW
Rust crate for scanning audio files, running DSP analysis, persisting metadata in SQLite, and exposing FFI-safe entry points.

## STRUCTURE
```text
core/
|- src/analysis/   # BPM, onset, kick, loop classification, MIDI decoding
|- src/db/         # schema + CRUD + FTS5 + embedding search
|- src/ffi/        # C ABI boundary (handle lifecycle + string ownership)
|- src/scanner/    # directory walk + file ingestion
|- src/search/     # search/filter helpers
|- src/manager.rs  # orchestration layer used by Tauri commands
|- src/threading/  # rayon + channel-based analysis pool
|- src/embedding/  # 64-dim placeholder embedder
`- tests/          # integration tests + audio/MIDI fixtures

## WHERE TO LOOK
| Task | Location | Notes |
|---|---|---|
| End-to-end workflow | `core/src/manager.rs` | Primary API used by `src-tauri` |
| SQL schema + migrations | `core/src/db/schema.rs` | Adds classification columns via migration |
| Query + update semantics | `core/src/db/operations.rs` | FTS escaping, COALESCE update rules |
| DSP behaviors | `core/src/analysis/*.rs` | Decode → onset/FFT → BPM/kick/loop; see analysis/AGENTS.md |
| Threaded persistence | `core/src/threading/mod.rs` | Writer thread + WAL checkpoint |
| C integration contracts | `core/src/ffi/handle.rs`, `core/src/ffi/functions.rs` | Null-safe C API + explicit free |
| MIDI decode | `core/src/analysis/midi.rs` | MIDI file parsing + metadata extraction |
| Scanner entry | `core/src/scanner/mod.rs` | Directory walk feeding analysis pipeline |

## CONVENTIONS
- Keep public surface re-exported through `core/src/lib.rs`.
- Preserve `SampleManager` as orchestration boundary; avoid direct cross-module calls from outer layers.
- Persist classification fields with explicit fallback defaults (`oneshot`, `other`) at DB layer.
- FFI functions return sentinel values (`-1` or null) instead of panicking; caller owns returned C strings.
- DSP analysis modules suppress clippy cast-precision warnings via `#[allow()]` — expected for f32/i64 DSP math.
- `unsafe` is confined to `core/src/ffi/`; do not introduce unsafe outside that boundary.

## ANTI-PATTERNS
- Do not pass externally-created pointers to `sm_free` or other handle APIs.
- Do not bypass migration-safe schema updates in `run_migrations`.
- Do not assume embedding search is indexed; it is O(N) brute-force over stored blobs.
- Do not unwrap in non-test production code paths; decoder panic on missing sample_rate is a known gap — use Result.

## COMMANDS
```bash
cargo check --workspace
cargo test --workspace
cargo test -p open-sample-manager-core
```

## NOTES
- `core/src/db/operations.rs` and `core/src/manager.rs` are high-change hotspots; keep edits surgical.
- Integration fixtures in `core/tests/fixtures/` are used for end-to-end pipeline assertions.
- `core` crate-type is `["cdylib", "rlib"]`; both dynamic (FFI) and static (Tauri) linkage are active.
- symphonia features locked to mp3/flac/wav/ogg/pcm — do not add formats without updating Cargo.toml features.
