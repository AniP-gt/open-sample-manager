# Random Inspiration

Random Inspiration adds three quick ways to audition sounds without changing the library or writing new metadata.

## Random

The `Random` button lives in the sample list toolbar. It chooses one sample from the same result set currently shown in the list or grid.

Active filters still apply:

- Search text
- BPM range
- Sample type
- Instrument type
- Musical key
- Favorites-only mode
- Directory filtering

If more than one result is available, `Random` avoids picking the currently selected sample. The selected row follows the same path as a manual click, so recent items, focus, and preview playback behavior stay consistent.

## Back

The `Back` button steps through earlier random picks from the current session. It's meant for quick auditioning, not full undo.

Use it when a random pick was close but the previous sound fit better. The button is disabled until at least one random pick can be restored.

## Random Similar Sample

The detail panel includes `Random similar sample` below `Find similar samples`.

This action runs the existing embedding similarity search for the selected sample, then chooses one usable match at random. It doesn't open the similar samples modal. Instead, it selects the matching sample directly.

Rules:

- The current sample is skipped when another similar result exists.
- Results without a file path are ignored.
- If no usable match exists, the app shows `No similar samples found`.
- If the selected sample has no path, the app shows `Sample path missing for embedding search`.

## Notes For Developers

The sample-list random flow is local to `SampleList` and uses `randomSelection.ts` for deterministic tests.

`Random similar sample` reuses the existing `search_by_embedding` Tauri command. It maps embedding rows through `mapEmbeddingRowToSample`, the same helper used by the similar samples modal.

No database schema or backend command changes are required.
