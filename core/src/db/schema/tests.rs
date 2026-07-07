use super::*;

#[test]
fn test_init_database_creates_tables() {
    let conn = Connection::open_in_memory().expect("Failed to create in-memory DB");
    init_database(&conn).expect("Failed to initialize database");

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

#[test]
fn test_samples_license_and_quality_columns() {
    let conn = Connection::open_in_memory().expect("Failed to create in-memory DB");
    init_database(&conn).expect("Failed to initialize database");

    let mut stmt = conn
        .prepare("PRAGMA table_info(samples)")
        .expect("Failed to prepare statement");

    let columns: Vec<String> = stmt
        .query_map([], |row| row.get(1))
        .expect("Failed to query columns")
        .collect::<Result<Vec<_>, _>>()
        .expect("Failed to collect columns");

    for column in [
        "source",
        "pack_name",
        "license",
        "license_url",
        "license_memo",
        "imported_at",
        "peak_db",
        "rms_db",
        "leading_silence_ms",
        "clipping_count",
        "channel_count",
        "bit_depth",
        "quality_flags",
    ] {
        assert!(columns.contains(&column.to_string()), "missing {column}");
    }
}
