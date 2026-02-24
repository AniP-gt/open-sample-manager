use rusqlite::Connection;

/// Initialize the database schema with all required tables, indices, and FTS5 virtual table.
///
/// This function creates:
/// - `samples` table: stores sample metadata and embeddings
/// - `tags` table: stores unique tag names
/// - `sample_tags` table: junction table for many-to-many sample-tag relationship
/// - `watched_paths` table: stores directory paths being monitored
/// - indices: for efficient querying on bpm, `sample_type`, `playback_type`, `instrument_type`
/// - `samples_fts`: FTS5 virtual table for full-text search on `file_name`
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

        CREATE INDEX IF NOT EXISTS idx_bpm ON samples(bpm);
        CREATE INDEX IF NOT EXISTS idx_type ON samples(sample_type);

        CREATE INDEX IF NOT EXISTS idx_sample_tags_sid ON sample_tags(sample_id);
        CREATE INDEX IF NOT EXISTS idx_sample_tags_tid ON sample_tags(tag_id);

        CREATE VIRTUAL TABLE IF NOT EXISTS samples_fts USING fts5(file_name);
        
        ",
    )?;
    run_migrations(conn)?;
    Ok(())
}

fn run_migrations(conn: &Connection) -> Result<(), rusqlite::Error> {
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
    }

    #[test]
    fn test_init_database_creates_fts5_table() {
        let conn = Connection::open_in_memory().expect("Failed to create in-memory DB");
        init_database(&conn).expect("Failed to initialize database");

        // Verify FTS5 virtual table exists
        let mut stmt = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='samples_fts'")
            .expect("Failed to prepare statement");

        let mut rows = stmt.query([]).expect("Failed to query FTS5 table");
        assert!(
            rows.next().expect("Failed to iterate rows").is_some(),
            "samples_fts FTS5 table not found"
        );
    }

    #[test]
    fn test_fts5_search_basic() {
        let conn = Connection::open_in_memory().expect("Failed to create in-memory DB");
        init_database(&conn).expect("Failed to initialize database");

        // Insert a sample
        conn.execute(
            "INSERT INTO samples (path, file_name) VALUES (?, ?)",
            rusqlite::params!("/path/to/kick_808.wav", "kick_808.wav"),
        )
        .expect("Failed to insert sample");

        // Insert into FTS5 table
        conn.execute(
            "INSERT INTO samples_fts (rowid, file_name) VALUES (1, ?)",
            rusqlite::params!("kick_808.wav"),
        )
        .expect("Failed to insert into FTS5");

        // Search for "kick" in FTS5
        let mut stmt = conn
            .prepare("SELECT rowid, file_name FROM samples_fts WHERE file_name MATCH 'kick'")
            .expect("Failed to prepare FTS5 query");

        let mut rows = stmt.query([]).expect("Failed to execute FTS5 query");
        let match_found = rows
            .next()
            .expect("Failed to iterate FTS5 results")
            .is_some();

        assert!(
            match_found,
            "FTS5 search did not find 'kick' in 'kick_808.wav'"
        );
    }

    #[test]
    fn test_wal_mode_enabled() {
        let tempdir = tempfile::TempDir::new().expect("Failed to create temp dir");
        let db_path = tempdir.path().join("test.db");
        let conn = Connection::open(&db_path).expect("Failed to create file-based DB");
        init_database(&conn).expect("Failed to initialize database");

        let mut stmt = conn
            .prepare("PRAGMA journal_mode")
            .expect("Failed to prepare pragma query");

        let journal_mode: String = stmt
            .query_row([], |row| row.get(0))
            .expect("Failed to query journal mode");

        assert_eq!(journal_mode.to_uppercase(), "WAL", "WAL mode not enabled");
    }

    #[test]
    fn test_samples_table_schema() {
        let conn = Connection::open_in_memory().expect("Failed to create in-memory DB");
        init_database(&conn).expect("Failed to initialize database");

        // Verify samples table has all required columns
        let mut stmt = conn
            .prepare("PRAGMA table_info(samples)")
            .expect("Failed to prepare pragma query");

        let columns: Vec<String> = stmt
            .query_map([], |row| row.get(1))
            .expect("Failed to query columns")
            .collect::<Result<Vec<_>, _>>()
            .expect("Failed to collect columns");

        let required_columns = vec![
            "id",
            "path",
            "file_name",
            "duration",
            "bpm",
            "periodicity",
            "low_ratio",
            "attack_slope",
            "decay_time",
            "sample_type",
            "playback_type",
            "instrument_type",
            "embedding",
            "is_online",
        ];

        for col in required_columns {
            assert!(
                columns.contains(&col.to_string()),
                "Column '{}' not found in samples table",
                col
            );
        }
    }
}
