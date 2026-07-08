# Duplicate Detection

Open Sample Manager can detect exact duplicate audio files during sample analysis. The feature is local-first: it stores duplicate metadata in the same SQLite database as the rest of the sample library and does not upload file contents or hashes.

## User Behavior

- Scanned audio files receive a `content_hash` derived from their file bytes.
- Samples with the same non-empty `content_hash` are treated as exact duplicates.
- The sample list can hide repeated rows while keeping the first visible sample from each duplicate group.
- Hidden duplicates are not deleted. They remain indexed, searchable, and available when the duplicate filter is turned off.
- Duplicate counts are exposed on sample rows so the UI can show or filter rows without running an extra scan.

This is exact file-content matching. It does not try to detect similar sounds, repitched samples, trimmed clips, or files that decode to the same audio but differ in container metadata.

## How It Works

The Rust analysis pipeline computes a streaming FNV-1a 64-bit hash for each analyzed sample file. The hash is stored in the `samples.content_hash` column and indexed for duplicate lookups.

The database layer exposes duplicate groups by selecting non-null hashes with more than one row. Each group includes:

- `content_hash`
- `sample_count`
- `total_file_size`
- the sample rows in that group

The Tauri command layer exposes this through `list_duplicate_groups`, keeping the same thin command-wrapper pattern used by other sample APIs.

The React UI maps `content_hash` and `duplicate_count` from backend rows into `Sample` objects. The `hideDuplicates` filter keeps the first loaded row for each duplicate hash and filters out later rows from the displayed sample list.

## Important Limits

- The hash is for local duplicate grouping, not security verification.
- Existing libraries need samples to be analyzed again before old rows receive `content_hash` values.
- Duplicate hiding applies to loaded sample rows in the current UI state.
- Near-duplicate detection still belongs to the embedding-based similarity workflow.

## Developer Notes

Main implementation points:

- `core/src/db/schema.rs` adds `content_hash` and the content-hash index.
- `core/src/db/operations/samples/queries.rs` calculates `duplicate_count` and lists duplicate groups.
- `core/src/manager/analyze.rs` computes the file-content hash during sample analysis.
- `core/src/manager/samples.rs` and `src-tauri/src/main.rs` expose duplicate groups through the manager and IPC boundary.
- `ui/src/hooks/useDisplayedSamples.ts` applies the duplicate-hiding filter.
- `ui/src/components/FilterSidebar/FilterSidebar.tsx` renders the duplicate visibility toggle.

Relevant checks:

```bash
cargo test --workspace
npm run typecheck --prefix ui
npm run test --prefix ui
npm run build --prefix ui
```
