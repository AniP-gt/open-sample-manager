# Collections and Saved Searches

Open Sample Manager includes two local-first organization tools for audio sample workflows: Collections and Saved Searches. Both are stored in the app's SQLite database, so they travel with the rest of the local metadata when the library database is exported and imported.

## Collections

Collections are manual sample groups. Use them for shortlists, project crates, sound-design batches, or any set of samples that should stay together even when their filenames, tags, BPM, or instrument classifications differ.

From the Collections panel you can:

- create a collection with a name and optional description
- open a collection to show only its samples in the main sample list
- add the currently selected sample rows to a collection
- remove selected samples from a collection
- rename or delete a collection
- leave collection view and return to the normal sample browser

Collection membership is sample-based and persistent. Deleting a collection removes only the collection and its membership rows; it does not delete the audio files or sample records.

## Saved Searches

Saved Searches store the current sample browser query, filters, directory scope, and sort order as a reusable preset. They are intended for searches you repeat often, such as "favorite kicks between 120 and 130 BPM" or "loops in this project folder sorted by key."

Saved Search presets include:

- text search
- sample type filter
- BPM minimum and maximum
- instrument type filter
- favorites-only state
- musical key filter
- directory path scope
- sort field and direction

Applying a saved search exits collection view, restores the saved filters and sort state, and refreshes the normal sample list with that preset.

## UI Flow

The right-side Collections and Saved Searches panel sits beside the sample list. Select samples in the list, then use `ADD SELECTED` under a collection to store those rows. Use `SAVE CURRENT FILTERS` under Saved Searches after configuring the search box, filters, directory scope, and sort order you want to keep.

When a collection is active, the main sample list shows the collection contents instead of the paginated library search results. `EXIT COLLECTION VIEW` returns the browser to the normal search and filter flow.

## Data Model

The feature adds three SQLite tables:

- `collections` stores collection names, descriptions, and timestamps
- `collection_members` stores ordered many-to-many membership by sample ID and `position`
- `saved_searches` stores reusable sample filter and sort presets

Legacy databases that contain `collection_samples` are migrated transactionally into `collection_members`, then the legacy table is dropped. Existing collection names are normalized by trimming, collapsing Unicode whitespace, and lowercasing; collisions merge into the earliest collection while appending unique members in stable order. Core database operations live under `core/src/db/operations/`, the public manager facade lives under `core/src/manager/`, and modular Tauri IPC commands live under `src-tauri/src/commands/collections.rs`. The React UI uses one `useCollections` owner for collection membership, saved searches, and collection view state.

## Limitations

Collections and Saved Searches currently apply to audio samples only. MIDI file organization still uses the MIDI tag system and MIDI search flow.
