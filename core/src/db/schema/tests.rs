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
        "content_hash",
    ] {
        assert!(columns.contains(&column.to_string()), "missing {column}");
    }
}

#[test]
fn init_database_migrates_legacy_samples_before_content_hash_index() {
    let conn = Connection::open_in_memory().expect("Failed to create in-memory DB");
    conn.execute_batch(
        "
        CREATE TABLE samples (
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
        ",
    )
    .expect("Failed to create legacy samples table");

    init_database(&conn).expect("Failed to migrate legacy database");

    let has_content_hash: bool = conn
        .query_row(
            "SELECT COUNT(*) > 0 FROM pragma_table_info('samples') WHERE name = 'content_hash'",
            [],
            |row| row.get(0),
        )
        .expect("Failed to inspect samples columns");
    let has_content_hash_index: bool = conn
        .query_row(
            "SELECT COUNT(*) > 0 FROM sqlite_master WHERE type = 'index' AND name = 'idx_content_hash'",
            [],
            |row| row.get(0),
        )
        .expect("Failed to inspect content hash index");

    assert!(has_content_hash);
    assert!(has_content_hash_index);
}

#[test]
fn init_database_records_and_retries_the_collections_migration_for_legacy_databases() {
    // Given: a database created before collections existed.
    let conn = Connection::open_in_memory().expect("Failed to create in-memory DB");
    conn.execute_batch(
        "
        CREATE TABLE samples (
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
        ",
    )
    .expect("Failed to create legacy samples table");

    // When: initialization upgrades it twice, as a restart after an interrupted run would.
    init_database(&conn).expect("Failed to upgrade legacy database");
    init_database(&conn).expect("Failed to retry completed migration");

    // Then: the collection migration is recorded once and creates its complete schema.
    let applied_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM schema_migrations WHERE version = ?1",
            [2_i64],
            |row| row.get(0),
        )
        .expect("Failed to inspect collection migration record");
    let foreign_keys_enabled: bool = conn
        .query_row("PRAGMA foreign_keys", [], |row| row.get(0))
        .expect("Failed to inspect foreign keys setting");
    let collection_tables: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name IN ('collections', 'collection_members')",
            [],
            |row| row.get(0),
        )
        .expect("Failed to inspect collection tables");

    assert_eq!(applied_count, 1);
    assert!(foreign_keys_enabled);
    assert_eq!(collection_tables, 2);
}

#[test]
fn init_database_repairs_collections_when_a_colliding_migration_version_is_already_recorded() {
    let conn = Connection::open_in_memory().expect("Failed to create in-memory DB");
    conn.execute_batch(
        "
        CREATE TABLE schema_migrations (
            version INTEGER PRIMARY KEY,
            applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        INSERT INTO schema_migrations (version) VALUES (1);
        ",
    )
    .expect("Failed to record colliding historical migration version");

    init_database(&conn).expect("Failed to repair collections schema");
    init_database(&conn).expect("Failed to retry repaired collections schema");

    let collection_tables: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name IN ('collections', 'collection_members')",
            [],
            |row| row.get(0),
        )
        .expect("Failed to inspect repaired collection tables");
    assert_eq!(collection_tables, 2);
}

#[test]
fn init_database_migrates_populated_legacy_collection_samples() {
    let conn = Connection::open_in_memory().expect("create database");
    conn.execute_batch(
        "CREATE TABLE samples (id INTEGER PRIMARY KEY, path TEXT UNIQUE NOT NULL, file_name TEXT NOT NULL, bpm REAL, sample_type TEXT);
         INSERT INTO samples (id, path, file_name) VALUES (1, '/tmp/one.wav', 'one.wav'), (2, '/tmp/two.wav', 'two.wav');
         CREATE TABLE collections (id INTEGER PRIMARY KEY, name TEXT UNIQUE NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
         CREATE TABLE collection_samples (
             collection_id INTEGER NOT NULL,
             sample_id INTEGER NOT NULL,
             added_at TEXT DEFAULT CURRENT_TIMESTAMP,
             PRIMARY KEY (collection_id, sample_id)
         );
         INSERT INTO collections (id, name) VALUES (1, 'Legacy');
         INSERT INTO collection_samples (collection_id, sample_id, added_at) VALUES
             (1, 2, '2026-01-01T00:00:02Z'),
             (1, 1, '2026-01-01T00:00:01Z');",
    )
    .expect("seed legacy collection data");

    init_database(&conn).expect("migrate legacy collection data");

    let members = conn
        .prepare(
            "SELECT sample_id FROM collection_members WHERE collection_id = 1 ORDER BY position",
        )
        .expect("prepare member query")
        .query_map([], |row| row.get::<_, i64>(0))
        .expect("query members")
        .collect::<Result<Vec<_>, _>>()
        .expect("collect members");
    let legacy_table_exists: bool = conn
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'collection_samples')",
            [],
            |row| row.get(0),
        )
        .expect("inspect legacy table");

    assert_eq!(members, vec![1, 2]);
    assert!(!legacy_table_exists);
}

#[test]
fn init_database_merges_normalized_legacy_collection_name_collisions() {
    let mut conn = Connection::open_in_memory().expect("create database");
    conn.execute_batch(
        "CREATE TABLE samples (id INTEGER PRIMARY KEY, path TEXT UNIQUE NOT NULL, file_name TEXT NOT NULL, bpm REAL, sample_type TEXT);
         INSERT INTO samples (id, path, file_name) VALUES (1, '/tmp/one.wav', 'one.wav'), (2, '/tmp/two.wav', 'two.wav');
         CREATE TABLE collections (id INTEGER PRIMARY KEY, name TEXT UNIQUE NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
         CREATE TABLE collection_samples (
             collection_id INTEGER NOT NULL,
             sample_id INTEGER NOT NULL,
             added_at TEXT DEFAULT CURRENT_TIMESTAMP,
             PRIMARY KEY (collection_id, sample_id)
         );
         INSERT INTO collections (id, name, created_at) VALUES (1, ' Drum   Kit ', '2026-01-01T00:00:01Z'), (2, 'drum kit', '2026-01-01T00:00:02Z');
         INSERT INTO collection_samples (collection_id, sample_id) VALUES (1, 1), (2, 2);",
    )
    .expect("seed colliding legacy collections");

    init_database(&conn).expect("merge legacy collection collisions");

    let collections = conn
        .prepare("SELECT id, name FROM collections ORDER BY id")
        .expect("prepare collection query")
        .query_map([], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
        })
        .expect("query collections")
        .collect::<Result<Vec<_>, _>>()
        .expect("collect collections");
    let members = conn
        .prepare(
            "SELECT sample_id FROM collection_members WHERE collection_id = 1 ORDER BY position",
        )
        .expect("prepare member query")
        .query_map([], |row| row.get::<_, i64>(0))
        .expect("query members")
        .collect::<Result<Vec<_>, _>>()
        .expect("collect members");
    let retry = crate::db::operations::add_samples_to_collection(&mut conn, " DRUM\tKIT ", &[1])
        .expect("add to normalized collection");

    assert_eq!(collections, vec![(1, "drum kit".to_string())]);
    assert_eq!(members, vec![1, 2]);
    assert!(!retry.created);
    assert_eq!(retry.collection_id, 1);
}

#[test]
fn init_database_preserves_user_collection_named_like_a_former_migration_temp_name() {
    let conn = Connection::open_in_memory().expect("create database");
    conn.execute_batch(
        "CREATE TABLE samples (id INTEGER PRIMARY KEY, path TEXT UNIQUE NOT NULL, file_name TEXT NOT NULL, bpm REAL, sample_type TEXT);
         INSERT INTO samples (id, path, file_name) VALUES
             (1, '/tmp/one.wav', 'one.wav'),
             (2, '/tmp/two.wav', 'two.wav'),
             (3, '/tmp/three.wav', 'three.wav');
         CREATE TABLE collections (id INTEGER PRIMARY KEY, name TEXT UNIQUE NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
         CREATE TABLE collection_samples (
             collection_id INTEGER NOT NULL,
             sample_id INTEGER NOT NULL,
             added_at TEXT DEFAULT CURRENT_TIMESTAMP,
             PRIMARY KEY (collection_id, sample_id)
         );
         INSERT INTO collections (id, name, created_at) VALUES
             (1, ' Drum   Kit ', '2026-01-01T00:00:01Z'),
             (2, '__osm_collection_migration_1', '2026-01-01T00:00:02Z'),
             (3, 'drum kit', '2026-01-01T00:00:03Z');
         INSERT INTO collection_samples (collection_id, sample_id) VALUES (1, 1), (2, 2), (3, 3);",
    )
    .expect("seed legacy collections including former temporary name");

    init_database(&conn).expect("migrate legacy collections without temporary-name collision");

    let collections = conn
        .prepare("SELECT id, name FROM collections ORDER BY id")
        .expect("prepare collection query")
        .query_map([], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
        })
        .expect("query collections")
        .collect::<Result<Vec<_>, _>>()
        .expect("collect collections");
    let drum_members = conn
        .prepare(
            "SELECT sample_id FROM collection_members WHERE collection_id = 1 ORDER BY position",
        )
        .expect("prepare drum member query")
        .query_map([], |row| row.get::<_, i64>(0))
        .expect("query drum members")
        .collect::<Result<Vec<_>, _>>()
        .expect("collect drum members");
    let user_members = conn
        .prepare(
            "SELECT sample_id FROM collection_members WHERE collection_id = 2 ORDER BY position",
        )
        .expect("prepare user member query")
        .query_map([], |row| row.get::<_, i64>(0))
        .expect("query user members")
        .collect::<Result<Vec<_>, _>>()
        .expect("collect user members");

    assert_eq!(
        collections,
        vec![
            (1, "drum kit".to_string()),
            (2, "__osm_collection_migration_1".to_string()),
        ],
    );
    assert_eq!(drum_members, vec![1, 3]);
    assert_eq!(user_members, vec![2]);
}

#[test]
fn test_init_database_creates_collection_tables() {
    let conn = Connection::open_in_memory().expect("Failed to create in-memory DB");
    init_database(&conn).expect("Failed to initialize database");

    let mut stmt = conn
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('collections', 'collection_members')")
        .expect("Failed to prepare table query");

    let tables: Vec<String> = stmt
        .query_map([], |row| row.get(0))
        .expect("Failed to query table names")
        .collect::<Result<Vec<_>, _>>()
        .expect("Failed to collect table names");

    assert!(
        tables.contains(&"collections".to_string()),
        "collections table not found"
    );
    assert!(
        tables.contains(&"collection_members".to_string()),
        "collection_members table not found"
    );
}

#[test]
fn test_init_database_creates_collection_indices() {
    let conn = Connection::open_in_memory().expect("Failed to create in-memory DB");
    init_database(&conn).expect("Failed to initialize database");

    let mut stmt = conn
        .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name IN ('idx_collections_name', 'idx_collection_members_collection_id', 'idx_collection_members_sample_id')")
        .expect("Failed to prepare index query");

    let indexes: Vec<String> = stmt
        .query_map([], |row| row.get(0))
        .expect("Failed to query indexes")
        .collect::<Result<Vec<_>, _>>()
        .expect("Failed to collect indexes");

    assert!(
        indexes.contains(&"idx_collections_name".to_string()),
        "idx_collections_name index not found"
    );
    assert!(
        indexes.contains(&"idx_collection_members_collection_id".to_string()),
        "idx_collection_members_collection_id index not found"
    );
    assert!(
        indexes.contains(&"idx_collection_members_sample_id".to_string()),
        "idx_collection_members_sample_id index not found"
    );
}
