use rusqlite::Connection;

use crate::db::operations::{
    add_project_collection_sample, clear_all_samples, create_project, delete_sample,
    get_default_project, list_other_project_used_sample_ids, list_project_collection_sample_ids,
    list_project_usage_events, list_project_used_sample_ids, record_project_sample_export,
    record_project_sample_selection, DEFAULT_PROJECT_ID,
};
use crate::db::schema::init_database;

fn setup_db() -> Connection {
    let conn = Connection::open_in_memory().expect("open in-memory db");
    init_database(&conn).expect("initialize schema");
    conn.execute(
        "INSERT INTO samples (id, path, file_name) VALUES (1, '/samples/kick.wav', 'kick.wav')",
        [],
    )
    .expect("insert sample 1");
    conn.execute(
        "INSERT INTO samples (id, path, file_name) VALUES (2, '/samples/snare.wav', 'snare.wav')",
        [],
    )
    .expect("insert sample 2");
    conn
}

#[test]
fn default_project_is_seeded() {
    let conn = setup_db();

    let project = get_default_project(&conn).expect("default project");

    assert_eq!(project.id, DEFAULT_PROJECT_ID);
    assert!(project.is_default);
}

#[test]
fn records_selection_and_export_events() {
    let conn = setup_db();

    let selected_id =
        record_project_sample_selection(&conn, DEFAULT_PROJECT_ID, 1).expect("selection");
    let exported_id =
        record_project_sample_export(&conn, DEFAULT_PROJECT_ID, 1, "processed").expect("export");
    let events = list_project_usage_events(&conn, DEFAULT_PROJECT_ID).expect("events");

    assert!(exported_id > selected_id);
    assert_eq!(events.len(), 2);
    assert_eq!(events[0].event_type, "exported");
    assert_eq!(events[0].variant.as_deref(), Some("processed"));
    assert_eq!(events[1].event_type, "selected");
}

#[test]
fn collection_is_idempotent_and_used_ids_include_events_and_collection() {
    let conn = setup_db();

    assert_eq!(
        add_project_collection_sample(&conn, DEFAULT_PROJECT_ID, 1).expect("add"),
        1
    );
    assert_eq!(
        add_project_collection_sample(&conn, DEFAULT_PROJECT_ID, 1).expect("add again"),
        0
    );
    record_project_sample_selection(&conn, DEFAULT_PROJECT_ID, 2).expect("selection");

    let collection =
        list_project_collection_sample_ids(&conn, DEFAULT_PROJECT_ID).expect("collection");
    let used = list_project_used_sample_ids(&conn, DEFAULT_PROJECT_ID).expect("used");

    assert_eq!(collection, vec![1]);
    assert_eq!(used, vec![1, 2]);
}

#[test]
fn creates_projects_with_unique_ids_and_tracks_other_project_usage() {
    let conn = setup_db();

    let first = create_project(&conn, "Song A").expect("create first project");
    let second = create_project(&conn, "Song A").expect("create second project");

    assert_eq!(first.id, "song-a");
    assert_eq!(second.id, "song-a-2");

    record_project_sample_selection(&conn, &first.id, 1).expect("first project selection");
    add_project_collection_sample(&conn, &second.id, 2).expect("second project collection");

    let first_other_used =
        list_other_project_used_sample_ids(&conn, &first.id).expect("other used for first");
    let second_other_used =
        list_other_project_used_sample_ids(&conn, &second.id).expect("other used for second");

    assert_eq!(first_other_used, vec![2]);
    assert_eq!(second_other_used, vec![1]);
}

#[test]
fn sample_delete_and_clear_remove_project_usage_rows() {
    let conn = setup_db();

    record_project_sample_selection(&conn, DEFAULT_PROJECT_ID, 1).expect("selection");
    add_project_collection_sample(&conn, DEFAULT_PROJECT_ID, 1).expect("collection");
    delete_sample(&conn, "/samples/kick.wav").expect("delete sample");

    assert!(list_project_used_sample_ids(&conn, DEFAULT_PROJECT_ID)
        .expect("used after delete")
        .is_empty());
    assert!(
        list_project_collection_sample_ids(&conn, DEFAULT_PROJECT_ID)
            .expect("collection after delete")
            .is_empty()
    );

    record_project_sample_selection(&conn, DEFAULT_PROJECT_ID, 2).expect("selection after delete");
    add_project_collection_sample(&conn, DEFAULT_PROJECT_ID, 2).expect("collection after delete");
    clear_all_samples(&conn).expect("clear samples");

    assert!(list_project_used_sample_ids(&conn, DEFAULT_PROJECT_ID)
        .expect("used after clear")
        .is_empty());
    assert!(
        list_project_collection_sample_ids(&conn, DEFAULT_PROJECT_ID)
            .expect("collection after clear")
            .is_empty()
    );
}

#[test]
fn legacy_database_migration_creates_usage_tables_and_keeps_default_project() {
    let conn = Connection::open_in_memory().expect("open in-memory db");
    conn.execute_batch(
        "CREATE TABLE samples (
            id INTEGER PRIMARY KEY,
            path TEXT UNIQUE NOT NULL,
            file_name TEXT NOT NULL,
            bpm REAL,
            sample_type TEXT
        );
        CREATE TABLE midis (
            id INTEGER PRIMARY KEY,
            path TEXT UNIQUE NOT NULL,
            file_name TEXT NOT NULL,
            tempo REAL,
            track_count INTEGER
        );",
    )
    .expect("create legacy samples table");

    init_database(&conn).expect("first migration");
    init_database(&conn).expect("second migration is idempotent");

    let project = get_default_project(&conn).expect("default project");
    let project_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM projects WHERE id = 'default'",
            [],
            |row| row.get(0),
        )
        .expect("default project count");
    let events_table_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'project_sample_events'", [], |row| row.get(0))
        .expect("events table count");
    let collection_table_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'project_collections'", [], |row| row.get(0))
        .expect("collections table count");

    assert_eq!(project.id, DEFAULT_PROJECT_ID);
    assert_eq!(project_count, 1);
    assert_eq!(events_table_count, 1);
    assert_eq!(collection_table_count, 1);
}
