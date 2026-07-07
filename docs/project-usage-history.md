# Project Usage History

Project Usage History tracks which samples were tried or exported while working on a DAW project. The current version uses one stable project row with the id `default`. Data is stored in the local SQLite database, so it follows the same backup and migration path as the sample library.

## Stored Data

The core database adds three tables.

| Table | Purpose |
|---|---|
| `projects` | Project records. A fresh database seeds `default` as the default project. |
| `project_sample_events` | Timestamped sample events. The app writes `selected` when a sample is chosen and `exported` when a drag to the DAW starts. |
| `project_collections` | Samples pinned to the project collection. Each project and sample pair is unique. |

Sample ids use `INTEGER` values because `samples.id` is an `i64` in the Rust core. Existing `localStorage` recent and favorite lists are unchanged. SQLite is the source of truth for project usage.

## Project Usage History

Selecting a sample records a `selected` event for the default project. The existing recent list still updates at the same time, but it stays in `localStorage` and is not used as the durable history source.

The sample list marks used rows with `USED`. A sample is considered used when it appears in project events or the project collection.

## Export History

Dragging a sample to a DAW records an `exported` event only after the native drag call succeeds. Failed drags don't write history.

The event variant shows what was sent.

| Variant | Meaning |
|---|---|
| `raw` | The original sample file was dragged. |
| `processed` | A rendered WAV with trim, fade, or gain edits was dragged. |

## Project Collection

Use the `P` button on a sample row to add or remove that sample from the project collection. Collection rows are stored in SQLite and can be listed by the core manager and Tauri commands.

Rows in the collection show `PROJECT` in the sample list. Adding the same sample again is safe because the database uses a unique project and sample pair.

## Avoid Reuse

Turn on `AVOID USED` in the sample list toolbar to hide used samples. This helps when browsing for fresh sounds after trying or exporting earlier candidates.

Avoid Reuse hides samples that are in the selection history, export history, or project collection for the active project. Turn it off to see the full library again.

## Notes For Developers

Core callers should go through `SampleManager` methods instead of opening a new database connection. Tauri commands follow the existing `AppState` manager lock pattern. UI callers use the typed project usage API and `useProjectUsage` hook.
