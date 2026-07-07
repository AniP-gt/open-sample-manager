# Search and Organization

The app combines backend search, UI filters, favorites, recent history, and editable labels so a large local library stays browsable.

## Search

Audio sample search is fuzzy over filenames and tags. Empty queries return the full list. MIDI search is fuzzy over filename and tag text.

SQLite FTS5 tables are maintained for sample and MIDI filenames, while the UI also applies list-level fuzzy matching and filters for fast browsing.

## Filters

The sample browser can filter by sample type, instrument type, BPM range, key, favorites, and directory. The MIDI browser can filter by filename, key, tempo, tags, and favorites.

Directory filtering can be enabled in Settings. When enabled, clicking a folder in the sidebar narrows the current library view to that folder.

## Favorites And Recent Samples

Audio samples and MIDI files each have their own favorite state. Favorites are saved locally and can be used as a focused browsing filter.

The sidebar also keeps a recent-samples list. Selecting a recent item jumps back to that sample without searching for it again.

## Classification Editing

Automatic analysis isn't always right. You can override a sample's playback type and instrument type from the app.

Instrument labels are user-editable. Custom instrument types are stored in SQLite and can be added, renamed, or deleted.

## File Actions

Rows expose file-level actions for common library work:

- Open the containing folder
- Copy the file path
- Move a file to trash
- Drag a file out to another app

Trash and temp-file cleanup are guarded by the desktop shell layer, so the app only deletes files through the intended file operations.
