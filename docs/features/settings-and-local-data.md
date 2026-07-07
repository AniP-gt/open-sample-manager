# Settings and Local Data

Open Sample Manager is local-first. It stores library metadata on your machine and doesn't require a cloud account.

## Local Database

The desktop app creates a `samples.db` SQLite database in the platform app-data directory. The database stores sample metadata, MIDI metadata, tags, instrument labels, watched paths, scan timestamps, and analysis results.

SQLite runs with WAL enabled. The app also keeps FTS5 tables for filename search.

## Settings

The Settings panel includes controls for:

- Auto-play when selecting a sample
- Instrument color coding
- Directory-click filtering
- TiMidity++ status and guidance
- Database export and import

Some UI preferences, such as favorites and recent sample history, are stored locally by the frontend.

## Library Migration

Settings can export the local metadata database as `samples.db` and import it on another machine.

This export is metadata only. It doesn't copy audio or MIDI files. Imported metadata resolves correctly only when the referenced files exist at the same paths on the target computer.

Database import validates the file before replacing the current database. If validation fails, the current database is kept.

## What Is Not Stored Remotely

The app doesn't upload your files, analysis data, tags, favorites, or settings to a cloud service. Everything described here is local to the machine running the app.
