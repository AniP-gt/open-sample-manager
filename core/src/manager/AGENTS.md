# CORE MANAGER

**Generated:** 2026-05-09T22:22:11+0900
**Commit:** a14778f

## OVERVIEW
`SampleManager` facade that composes scanner, analysis, DB operations, and MIDI workflows for Tauri and FFI callers.

## STRUCTURE
```text
manager/
|- mod.rs      # public facade, errors, progress types, method groups
|- analyze.rs  # decode/classify/key/embedding/waveform -> SampleInput
|- audio.rs    # waveform peak JSON + artist metadata extraction
|- scan.rs     # parallel scan with progress + transaction
|- midi.rs     # MIDI parse/store/list/tag helpers
`- tests.rs    # manager-level integration-style unit tests
```

## WHERE TO LOOK
| Task | Location | Notes |
|---|---|---|
| Public API | `mod.rs` | `SampleManager`, `ManagerError`, `ScanProgress`, `ScanStage` |
| Audio import | `analyze.rs` | Instrument filename inference, waveform peaks, embeddings |
| Directory scan | `scan.rs` | Skip existing paths, rayon producer, DB transaction |
| MIDI scan | `midi.rs` | Parse `.mid/.midi`, store rows/tags |
| Metadata helpers | `audio.rs` | Symphonia artist tags, waveform peak serialization |
| Tests | `tests.rs` | temp DBs/files, scan/search/classification roundtrips |

## CONVENTIONS
- Keep outer callers on `SampleManager`; submodules are `pub(super)` implementation detail.
- `ManagerError` currently wraps DB, decode, and IO; Tauri maps it into `CommandError`.
- `scan_with_progress` emits discovering/analyzing/complete stages expected by Tauri/UI.
- `scan_with_progress` uses a producer thread plus rayon, then writes inside one `BEGIN IMMEDIATE` transaction.
- Decode errors during scan are skipped; non-decode errors roll back the transaction.
- Filename instrument inference returns seeded DB labels only: kick, snare, hihat, bass, synth, fx, vocal, percussion, other.

## ANTI-PATTERNS
- Do not add direct UI/Tauri concerns here; expose core operations only.
- Do not change progress stage strings without checking `src-tauri` conversion and UI `ScanProgress` type.
- Do not write individual sample rows outside the transaction in scan flow.
- Do not widen instrument labels without updating DB seeds, UI defaults, and tests.

## COMMANDS
```bash
cargo test -p open-sample-manager-core manager
```

## NOTES
- `mod.rs` groups methods by lifecycle, sample scan/CRUD, instrument types, MIDI, and MIDI tags.
- `update_sample_classification` reloads the existing row first, then preserves unspecified fields.
