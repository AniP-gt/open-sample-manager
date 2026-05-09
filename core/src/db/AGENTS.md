# CORE DB

**Generated:** 2026-05-09T22:22:11+0900
**Commit:** a14778f

## OVERVIEW
SQLite schema, migrations, seed data, CRUD, FTS5 search, MIDI tags, and brute-force embedding lookup.

## STRUCTURE
```text
db/
|- schema.rs              # tables, indexes, migrations, default seeds
`- operations/
   |- samples.rs          # sample CRUD/search/embedding hotspot
   |- midi.rs             # MIDI CRUD/search/tags
   |- instrument_types.rs # custom instrument labels
   `- types.rs            # row/input structs shared with manager/Tauri
```

## WHERE TO LOOK
| Task | Location | Notes |
|---|---|---|
| Fresh schema | `schema.rs:init_database` | WAL, tables, indexes, `samples_fts`, `midis_fts` |
| Legacy migration | `schema.rs:run_migrations` | Best-effort ALTERs for added columns/tables |
| Seed data | `schema.rs:seed_instrument_types`, `seed_midi_tags` | Defaults surfaced in UI |
| Sample insert/update | `operations/samples.rs` | Maintains FTS rows manually |
| Sample search | `operations/samples.rs:search_samples*` | FTS first, syntax-error escape fallback |
| Embedding search | `operations/samples.rs:search_by_embedding` | O(N), blob dimension checked before cosine |
| MIDI search/tags | `operations/midi.rs` | `midis_fts`, `midi_file_tags`, `COALESCE(t.name, '')` |
| Row contracts | `operations/types.rs` | `SampleRow`, `MidiRow`, input structs |

## CONVENTIONS
- Use `prepare_cached` and `rusqlite::params!` for queries.
- Keep `samples_fts` and `midis_fts` synchronized on insert/update/delete/clear/move.
- Preserve classification defaults: `playback_type='oneshot'`, `instrument_type='other'`.
- Preserve optional update semantics with `COALESCE` when caller sends partial classification/key fields.
- Empty sample search returns all rows; empty paginated search delegates to paginated list.
- FTS syntax errors should escape or return empty rows, not bubble user-query syntax failures.

## ANTI-PATTERNS
- Do not add schema columns only to `CREATE TABLE`; add idempotent migration logic too.
- Do not change row select column order/names without updating `row_to_sample`, UI Tauri row types, and tests.
- Do not introduce an embedding index assumption; current search scans all non-null embeddings.
- Do not delete FTS maintenance when changing path/file-name logic.

## COMMANDS
```bash
cargo test -p open-sample-manager-core db::schema
cargo test -p open-sample-manager-core db::operations::samples
```

## NOTES
- `operations/samples.rs` is a dense hotspot and has regression tests for FTS, classification, delete, and roundtrip behavior.
- `run_migrations` intentionally ignores some ALTER errors for already-migrated legacy DBs.
