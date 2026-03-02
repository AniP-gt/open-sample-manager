use rusqlite::{params, Connection};

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

        CREATE INDEX IF NOT EXISTS idx_bpm ON samples(bpm);
        CREATE INDEX IF NOT EXISTS idx_type ON samples(sample_type);

        CREATE INDEX IF NOT EXISTS idx_sample_tags_sid ON sample_tags(sample_id);
        CREATE INDEX IF NOT EXISTS idx_sample_tags_tid ON sample_tags(tag_id);

        CREATE INDEX IF NOT EXISTS idx_midis_tempo ON midis(tempo);
        CREATE INDEX IF NOT EXISTS idx_midis_track_count ON midis(track_count);
        CREATE INDEX IF NOT EXISTS idx_midi_file_tags_mid ON midi_file_tags(midi_id);

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
        CREATE INDEX IF NOT EXISTS idx_midi_file_tags_mid ON midi_file_tags(midi_id);"
    );

    Ok(())
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
mod tests {
    use super::*;

    #[test]
    fn test_init_database_creates_tables() {
        let conn = Connection::open_in_memory().expect("Failed to create in-memory DB");
        init_database(&conn).expect("Failed to initialize database");

        // Verify all tables exist in sqlite_master
        let mut stmt = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='table'")
            .expect("Failed to prepare statement");

        let tables: Vec<String> = stmt
            .query_map([], |row| row.get(0))
            .expect("Failed to query tables")
            .collect::<Result<Vec<_>, _>>()
            .expect("Failed to collect tables");

        assert!(
            tables.contains(&"samples".to_string()),
            "samples table not found"
        );
        assert!(tables.contains(&"tags".to_string()), "tags table not found");
        assert!(
            tables.contains(&"sample_tags".to_string()),
            "sample_tags table not found"
        );
        assert!(
            tables.contains(&"watched_paths".to_string()),
            "watched_paths table not found"
        );
        assert!(
            tables.contains(&"midis".to_string()),
            "midis table not found"
        );
    }

    #[test]
    fn test_init_database_creates_indices() {
        let conn = Connection::open_in_memory().expect("Failed to create in-memory DB");
        init_database(&conn).expect("Failed to initialize database");

        // Verify all indices exist
        let mut stmt = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='index'")
            .expect("Failed to prepare statement");

        let indices: Vec<String> = stmt
            .query_map([], |row| row.get(0))
            .expect("Failed to query indices")
            .collect::<Result<Vec<_>, _>>()
            .expect("Failed to collect indices");

        assert!(
            indices.contains(&"idx_bpm".to_string()),
            "idx_bpm index not found"
        );
        assert!(
            indices.contains(&"idx_type".to_string()),
            "idx_type index not found"
        );
        assert!(
            indices.contains(&"idx_playback_type".to_string()),
            "idx_playback_type index not found"
        );
        assert!(
            indices.contains(&"idx_instrument_type".to_string()),
            "idx_instrument_type index not found"
        );
        assert!(
            indices.contains(&"idx_sample_tags_sid".to_string()),
            "idx_sample_tags_sid index not found"
        );
        assert!(
            indices.contains(&"idx_sample_tags_tid".to_string()),
            "idx_sample_tags_tid index not found"
        );
        assert!(
            indices.contains(&"idx_midis_tempo".to_string()),
            "idx_midis_tempo index not found"
        );
        assert!(
            indices.contains(&"idx_midis_track_count".to_string()),
            "idx_midis_track_count index not found"
        );
    }

    #[test]
    fn test_init_database_creates_fts5_table() {
        let conn = Connection::open_in_memory().expect("Failed to create in-memory DB");
        init_database(&conn).expect("Failed to initialize database");

        // Verify FTS5 virtual tables exist
        let mut stmt = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='samples_fts'")
            .expect("Failed to prepare statement");

        let mut rows = stmt.query([]).expect("Failed to query FTS5 table");
        assert!(
            rows.next().expect("Failed to iterate rows").is_some(),
            "samples_fts FTS5 table not found"
        );

        let mut stmt = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='midis_fts'")
            .expect("Failed to prepare statement");

        let mut rows = stmt.query([]).expect("Failed to query FTS5 table");
        assert!(
            rows.next().expect("Failed to iterate rows").is_some(),
            "midis_fts FTS5 table not found"
        );
    }

    #[test]
    fn test_seed_instrument_types() {
        let conn = Connection::open_in_memory().expect("Failed to create in-memory DB");
        init_database(&conn).expect("Failed to initialize database");

        let mut stmt = conn
            .prepare("SELECT name FROM instrument_types")
            .expect("Failed to prepare statement");

        let types: Vec<String> = stmt
            .query_map([], |row| row.get(0))
            .expect("Failed to query instrument types")
            .collect::<Result<Vec<_>, _>>()
            .expect("Failed to collect instrument types");

        assert!(types.contains(&"kick".to_string()));
        assert!(types.contains(&"snare".to_string()));
        assert!(types.contains(&"bass".to_string()));
    }

    #[test]
    fn test_midis_columns() {
        let conn = Connection::open_in_memory().expect("Failed to create in-memory DB");
        init_database(&conn).expect("Failed to initialize database");

        // Verify midis table has all expected columns
        let mut stmt = conn
            .prepare("PRAGMA table_info(midis)")
            .expect("Failed to prepare statement");

        let columns: Vec<String> = stmt
            .query_map([], |row| row.get(1))
            .expect("Failed to query columns")
            .collect::<Result<Vec<_>, _>>()
            .expect("Failed to collect columns");

        assert!(columns.contains(&"path".to_string()));
        assert!(columns.contains(&"file_name".to_string()));
        assert!(columns.contains(&"duration".to_string()));
        assert!(columns.contains(&"tempo".to_string()));
        assert!(columns.contains(&"track_count".to_string()));
        assert!(columns.contains(&"note_count".to_string()));
        assert!(columns.contains(&"channel_count".to_string()));
        assert!(columns.contains(&"key_estimate".to_string()));
    }
}
