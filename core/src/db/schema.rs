use std::collections::BTreeMap;

use rusqlite::{params, Connection, Transaction};

const COLLECTIONS_MIGRATION_VERSION: i64 = 2;

/// Initialize the database schema with all required tables, indices, and FTS5 virtual table.
///
/// This function creates:
/// - `samples` table: stores sample metadata and embeddings
/// - `tags` table: stores unique tag names
/// - `sample_tags` table: junction table for many-to-many sample-tag relationship
/// - `watched_paths` table: stores directory paths being monitored
/// - `midis` table: stores MIDI file metadata
/// - `midi_tags` table: user-defined tags for MIDI files (id, name, created_at)
/// - `samples_fts`: FTS5 virtual table for full-text search on `file_name`
/// - `midis_fts`: FTS5 virtual table for MIDI file name search
/// - `collections`: user-defined collections of samples
/// - `collection_members`: ordered sample membership per collection
///
/// # Arguments
/// * `conn` - `SQLite` connection to initialize
///
/// # Returns
/// Ok(()) if successful, `Err(rusqlite::Error)` if schema creation fails
///
/// # Errors
/// Returns `rusqlite::Error` if any SQL statement fails during schema initialization.
pub fn init_database(conn: &Connection) -> Result<(), rusqlite::Error> {
    // Ensure foreign key constraints are enforced for FK-dependent behavior (
    // cascading deletes and FK-based rollbacks).
    conn.pragma_update(None, "foreign_keys", true)?;

    conn.execute_batch(
        "
        PRAGMA journal_mode = WAL;

        CREATE TABLE IF NOT EXISTS samples (
            id INTEGER PRIMARY KEY,
            path TEXT UNIQUE NOT NULL,
            file_name TEXT NOT NULL,
            duration REAL,
            bpm REAL,
            periodicity REAL,
            low_ratio REAL,
            sample_rate INTEGER,
            file_size INTEGER,
            artist TEXT,
            attack_slope REAL,
            decay_time REAL,
            sample_type TEXT,
            waveform_peaks TEXT,
            embedding BLOB,
            source TEXT,
            pack_name TEXT,
            license TEXT,
            license_url TEXT,
            license_memo TEXT,
            imported_at TEXT DEFAULT CURRENT_TIMESTAMP,
            peak_db REAL,
            rms_db REAL,
            leading_silence_ms REAL,
            clipping_count INTEGER,
            channel_count INTEGER,
            bit_depth INTEGER,
            quality_flags TEXT,
            content_hash TEXT,
            is_online INTEGER DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS tags (
            id INTEGER PRIMARY KEY,
            name TEXT UNIQUE NOT NULL
        );

        CREATE TABLE IF NOT EXISTS sample_tags (
            sample_id INTEGER NOT NULL,
            tag_id INTEGER NOT NULL,
            FOREIGN KEY (sample_id) REFERENCES samples(id),
            FOREIGN KEY (tag_id) REFERENCES tags(id)
        );

        CREATE TABLE IF NOT EXISTS watched_paths (
            id INTEGER PRIMARY KEY,
            path TEXT UNIQUE NOT NULL,
            label TEXT,
            is_external INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS instrument_types (
            id INTEGER PRIMARY KEY,
            name TEXT UNIQUE NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS midis (
            id INTEGER PRIMARY KEY,
            path TEXT UNIQUE NOT NULL,
            file_name TEXT NOT NULL,
            duration REAL,
            tempo REAL,
            time_signature_numerator INTEGER DEFAULT 4,
            time_signature_denominator INTEGER DEFAULT 4,
            track_count INTEGER,
            note_count INTEGER,
            channel_count INTEGER,
            key_estimate TEXT,
            file_size INTEGER,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            modified_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS midi_tags (
            id INTEGER PRIMARY KEY,
            name TEXT UNIQUE NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS midi_file_tags (
            midi_id INTEGER NOT NULL,
            tag_id INTEGER NOT NULL,
            PRIMARY KEY (midi_id, tag_id),
            FOREIGN KEY (midi_id) REFERENCES midis(id) ON DELETE CASCADE,
            FOREIGN KEY (tag_id) REFERENCES midi_tags(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS collections (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            description TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS collection_members (
            collection_id INTEGER NOT NULL,
            sample_id INTEGER NOT NULL,
            position INTEGER NOT NULL,
            PRIMARY KEY (collection_id, sample_id),
            FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
            FOREIGN KEY (sample_id) REFERENCES samples(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS saved_searches (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            search TEXT NOT NULL DEFAULT '',
            filter_type TEXT NOT NULL DEFAULT 'all',
            filter_bpm_min TEXT NOT NULL DEFAULT '',
            filter_bpm_max TEXT NOT NULL DEFAULT '',
            filter_instrument_type TEXT NOT NULL DEFAULT '',
            favorites_only INTEGER NOT NULL DEFAULT 0,
            filter_key TEXT NOT NULL DEFAULT '',
            directory_path TEXT NOT NULL DEFAULT '',
            sort_field TEXT NOT NULL DEFAULT 'id',
            sort_direction TEXT NOT NULL DEFAULT 'asc',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_bpm ON samples(bpm);
        CREATE INDEX IF NOT EXISTS idx_type ON samples(sample_type);

        CREATE INDEX IF NOT EXISTS idx_sample_tags_sid ON sample_tags(sample_id);
        CREATE INDEX IF NOT EXISTS idx_sample_tags_tid ON sample_tags(tag_id);
        CREATE INDEX IF NOT EXISTS idx_midis_tempo ON midis(tempo);
        CREATE INDEX IF NOT EXISTS idx_midis_track_count ON midis(track_count);
        CREATE INDEX IF NOT EXISTS idx_midi_file_tags_mid ON midi_file_tags(midi_id);
        CREATE INDEX IF NOT EXISTS idx_collections_name ON collections(name);
        CREATE INDEX IF NOT EXISTS idx_collection_members_collection_id ON collection_members(collection_id);
        CREATE INDEX IF NOT EXISTS idx_collection_members_sample_id ON collection_members(sample_id);
        CREATE INDEX IF NOT EXISTS idx_saved_searches_name ON saved_searches(name);

        CREATE VIRTUAL TABLE IF NOT EXISTS samples_fts USING fts5(file_name);
        CREATE VIRTUAL TABLE IF NOT EXISTS midis_fts USING fts5(file_name);
        ",
    )?;

    // Run migrations to add newer columns to legacy DBs, then seed defaults.
    run_migrations(conn)?;
    // Seed default instrument types
    seed_instrument_types(conn)?;

    // Seed default MIDI tags
    seed_midi_tags(conn)?;
    // Seed default instrument types

    Ok(())
}

fn run_migrations(conn: &Connection) -> Result<(), rusqlite::Error> {
    // Ensure legacy databases receive new columns added over time.
    // Add `sample_rate` if missing (older DBs created before this column existed).
    let has_sample_rate: bool = conn
        .query_row(
            "SELECT COUNT(*) > 0 FROM PRAGMA table_info(samples) WHERE name = 'sample_rate'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(false);

    if !has_sample_rate {
        // best-effort: ignore error when column already exists or other issues
        let _ = conn.execute("ALTER TABLE samples ADD COLUMN sample_rate INTEGER", []);
    }

    let has_file_size: bool = conn
        .query_row(
            "SELECT COUNT(*) > 0 FROM PRAGMA table_info(samples) WHERE name = 'file_size'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(false);

    if !has_file_size {
        let _ = conn.execute("ALTER TABLE samples ADD COLUMN file_size INTEGER", []);
    }

    let has_artist: bool = conn
        .query_row(
            "SELECT COUNT(*) > 0 FROM PRAGMA table_info(samples) WHERE name = 'artist'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(false);

    if !has_artist {
        let _ = conn.execute("ALTER TABLE samples ADD COLUMN artist TEXT", []);
    }

    let has_waveform_peaks: bool = conn
        .query_row(
            "SELECT COUNT(*) > 0 FROM PRAGMA table_info(samples) WHERE name = 'waveform_peaks'",
            [],
            |row| row.get(0),
        )
        .unwrap_or(false);

    if !has_waveform_peaks {
        let _ = conn.execute("ALTER TABLE samples ADD COLUMN waveform_peaks TEXT", []);
    }
    // Migration for 2-layer classification: add playback_type and instrument_type columns
    // Use result ignore pattern to handle cases where column already exists
    let _ = conn.execute(
        "ALTER TABLE samples ADD COLUMN playback_type TEXT NOT NULL DEFAULT 'oneshot'",
        [],
    );
    let _ = conn.execute(
        "ALTER TABLE samples ADD COLUMN instrument_type TEXT NOT NULL DEFAULT 'other'",
        [],
    );

    // Create indices for 2-layer classification columns
    // Use IF NOT EXISTS to handle both fresh and existing databases
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_playback_type ON samples(playback_type)",
        [],
    )?;
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_instrument_type ON samples(instrument_type)",
        [],
    )?;

    // Create indices for midis table (if table exists)
    let _ = conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_midis_tempo ON midis(tempo)",
        [],
    );
    let _ = conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_midis_track_count ON midis(track_count)",
        [],
    );

    // Migration: create midi_tags and midi_file_tags tables for existing DBs
    // that were created before these tables existed.
    let _ = conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS midi_tags (
            id INTEGER PRIMARY KEY,
            name TEXT UNIQUE NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS midi_file_tags (
            midi_id INTEGER NOT NULL,
            tag_id INTEGER NOT NULL,
            PRIMARY KEY (midi_id, tag_id),
            FOREIGN KEY (midi_id) REFERENCES midis(id) ON DELETE CASCADE,
            FOREIGN KEY (tag_id) REFERENCES midi_tags(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_midi_file_tags_mid ON midi_file_tags(midi_id);",
    );

    run_collections_migration(conn)?;

    // Migration: add musical_key column to samples
    let _ = conn.execute("ALTER TABLE samples ADD COLUMN musical_key TEXT", []);

    let _ = conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS saved_searches (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            search TEXT NOT NULL DEFAULT '',
            filter_type TEXT NOT NULL DEFAULT 'all',
            filter_bpm_min TEXT NOT NULL DEFAULT '',
            filter_bpm_max TEXT NOT NULL DEFAULT '',
            filter_instrument_type TEXT NOT NULL DEFAULT '',
            favorites_only INTEGER NOT NULL DEFAULT 0,
            filter_key TEXT NOT NULL DEFAULT '',
            directory_path TEXT NOT NULL DEFAULT '',
            sort_field TEXT NOT NULL DEFAULT 'id',
            sort_direction TEXT NOT NULL DEFAULT 'asc',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_saved_searches_name ON saved_searches(name);",
    );

    for (name, definition) in [
        ("source", "source TEXT"),
        ("pack_name", "pack_name TEXT"),
        ("license", "license TEXT"),
        ("license_url", "license_url TEXT"),
        ("license_memo", "license_memo TEXT"),
        ("imported_at", "imported_at TEXT"),
        ("peak_db", "peak_db REAL"),
        ("rms_db", "rms_db REAL"),
        ("leading_silence_ms", "leading_silence_ms REAL"),
        ("clipping_count", "clipping_count INTEGER"),
        ("channel_count", "channel_count INTEGER"),
        ("bit_depth", "bit_depth INTEGER"),
        ("quality_flags", "quality_flags TEXT"),
    ] {
        add_samples_column_if_missing(conn, name, definition);
    }

    let _ = conn.execute(
        "UPDATE samples SET imported_at = CURRENT_TIMESTAMP WHERE imported_at IS NULL",
        [],
    );

    add_samples_column_if_missing(conn, "content_hash", "content_hash TEXT");
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_content_hash ON samples(content_hash)",
        [],
    )?;
    Ok(())
}

fn run_collections_migration(conn: &Connection) -> Result<(), rusqlite::Error> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );",
    )?;

    let tx = conn.unchecked_transaction()?;
    tx.execute_batch(
        "CREATE TABLE IF NOT EXISTS collections (
            id INTEGER PRIMARY KEY,
            name TEXT UNIQUE NOT NULL,
            description TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
            ,updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS collection_members (
            collection_id INTEGER NOT NULL,
            sample_id INTEGER NOT NULL,
            position INTEGER NOT NULL,
            PRIMARY KEY (collection_id, sample_id),
            FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
            FOREIGN KEY (sample_id) REFERENCES samples(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_collections_name ON collections(name);
        CREATE INDEX IF NOT EXISTS idx_collection_members_collection_id ON collection_members(collection_id);
         CREATE INDEX IF NOT EXISTS idx_collection_members_sample_id ON collection_members(sample_id);",
    )?;
    add_collection_column_if_missing(&tx, "description", "description TEXT")?;
    add_collection_column_if_missing(&tx, "updated_at", "updated_at TEXT")?;
    tx.execute(
        "UPDATE collections SET updated_at = CURRENT_TIMESTAMP WHERE updated_at IS NULL",
        [],
    )?;
    if table_exists(&tx, "collection_samples")? {
        tx.execute_batch(
            "INSERT OR IGNORE INTO collection_members (collection_id, sample_id, position)
             SELECT legacy.collection_id, legacy.sample_id,
                    1 + (
                        SELECT COUNT(*)
                        FROM collection_samples preceding
                        WHERE preceding.collection_id = legacy.collection_id
                          AND (
                            preceding.added_at < legacy.added_at
                            OR (preceding.added_at = legacy.added_at AND preceding.rowid < legacy.rowid)
                          )
                    )
             FROM collection_samples legacy
             ORDER BY legacy.collection_id, legacy.added_at, legacy.rowid;
             DROP TABLE collection_samples;",
        )?;
    }
    normalize_collection_names_and_merge_members(&tx)?;
    tx.execute(
        "INSERT OR IGNORE INTO schema_migrations (version) VALUES (?1)",
        [COLLECTIONS_MIGRATION_VERSION],
    )?;
    tx.commit()
}

fn normalize_collection_names_and_merge_members(
    tx: &Transaction<'_>,
) -> Result<(), rusqlite::Error> {
    let mut stmt = tx.prepare_cached("SELECT id, name FROM collections ORDER BY created_at, id")?;
    let rows = stmt
        .query_map([], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
        })?
        .collect::<Result<Vec<_>, _>>()?;
    let mut groups = BTreeMap::<String, Vec<i64>>::new();
    for (id, name) in &rows {
        groups
            .entry(normalize_collection_name(name))
            .or_default()
            .push(*id);
    }

    for (normalized_name, collection_ids) in groups {
        let Some((&keeper_id, duplicate_ids)) = collection_ids.split_first() else {
            continue;
        };

        let mut next_position: i64 = tx.query_row(
            "SELECT COALESCE(MAX(position), 0) + 1 FROM collection_members WHERE collection_id = ?1",
            params![keeper_id],
            |row| row.get(0),
        )?;
        for duplicate_id in duplicate_ids {
            let mut member_stmt = tx.prepare_cached(
                "SELECT sample_id FROM collection_members WHERE collection_id = ?1 ORDER BY position, sample_id",
            )?;
            let members = member_stmt
                .query_map(params![duplicate_id], |row| row.get::<_, i64>(0))?
                .collect::<Result<Vec<_>, _>>()?;
            let mut insert_stmt = tx.prepare_cached(
                "INSERT INTO collection_members (collection_id, sample_id, position) VALUES (?1, ?2, ?3) ON CONFLICT(collection_id, sample_id) DO NOTHING",
            )?;
            for sample_id in members {
                if insert_stmt.execute(params![keeper_id, sample_id, next_position])? > 0 {
                    next_position += 1;
                }
            }
            tx.execute(
                "DELETE FROM collections WHERE id = ?1",
                params![duplicate_id],
            )?;
        }
        tx.execute(
            "UPDATE collections SET name = ?1 WHERE id = ?2",
            params![normalized_name, keeper_id],
        )?;
    }
    Ok(())
}

fn normalize_collection_name(name: &str) -> String {
    let mut normalized = String::with_capacity(name.len());
    let mut previous_was_space = false;
    for ch in name.trim().chars() {
        if ch.is_whitespace() {
            if !previous_was_space {
                normalized.push(' ');
                previous_was_space = true;
            }
        } else {
            normalized.extend(ch.to_lowercase());
            previous_was_space = false;
        }
    }
    normalized.trim().to_string()
}

fn table_exists(conn: &Connection, table: &str) -> Result<bool, rusqlite::Error> {
    conn.query_row(
        "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?1)",
        params![table],
        |row| row.get(0),
    )
}

fn add_collection_column_if_missing(
    conn: &Connection,
    name: &str,
    definition: &str,
) -> Result<(), rusqlite::Error> {
    let has_column: bool = conn.query_row(
        "SELECT COUNT(*) > 0 FROM pragma_table_info('collections') WHERE name = ?1",
        params![name],
        |row| row.get(0),
    )?;
    if !has_column {
        conn.execute(
            &format!("ALTER TABLE collections ADD COLUMN {definition}"),
            [],
        )?;
    }
    Ok(())
}

fn add_samples_column_if_missing(conn: &Connection, name: &str, definition: &str) {
    let has_column: bool = conn
        .query_row(
            "SELECT COUNT(*) > 0 FROM PRAGMA table_info(samples) WHERE name = ?1",
            params![name],
            |row| row.get(0),
        )
        .unwrap_or(false);

    if !has_column {
        let _ = conn.execute(&format!("ALTER TABLE samples ADD COLUMN {definition}"), []);
    }
}

fn seed_instrument_types(conn: &Connection) -> Result<(), rusqlite::Error> {
    let instrument_types = [
        "kick",
        "snare",
        "hihat",
        "bass",
        "synth",
        "fx",
        "vocal",
        "percussion",
        "other",
    ];

    for name in instrument_types {
        conn.execute(
            "INSERT OR IGNORE INTO instrument_types (name) VALUES (?1)",
            params![name],
        )?;
    }

    Ok(())
}

fn seed_midi_tags(conn: &Connection) -> Result<(), rusqlite::Error> {
    // Musical role / purpose tags
    let midi_tags = [
        // Musical roles
        "melody",
        "chord",
        "bass",
        "arp",
        "lead",
        "pad",
        "drum",
        "transition",
        "fx",
        "intro",
        "outro",
        "loop",
        "oneshot",
        // Instrument categories
        "piano",
        "guitar",
        "strings",
        "brass",
        "synth",
        "percussion",
        "vocal",
        "other",
    ];

    for name in midi_tags {
        conn.execute(
            "INSERT OR IGNORE INTO midi_tags (name) VALUES (?1)",
            params![name],
        )?;
    }

    Ok(())
}

#[cfg(test)]
mod tests;
