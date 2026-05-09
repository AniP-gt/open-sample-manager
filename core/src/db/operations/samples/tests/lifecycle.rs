use rusqlite::params;

use crate::db::operations::{
    clear_all_samples, delete_sample, get_sample_by_path, insert_sample, move_sample_path,
    search_samples, update_sample, SampleInput,
};

use super::{make_input, setup_db};

#[test]
fn test_delete_sample_removes_row() {
    let conn = setup_db();
    insert_sample(&conn, &make_input("/samples/kick.wav", "kick.wav")).expect("insert failed");
    assert_eq!(
        delete_sample(&conn, "/samples/kick.wav").expect("delete failed"),
        1
    );
    assert!(get_sample_by_path(&conn, "/samples/kick.wav")
        .expect("query failed")
        .is_none());
}

#[test]
fn test_delete_sample_removes_search_result() {
    let conn = setup_db();
    insert_sample(&conn, &make_input("/samples/kick.wav", "kick.wav")).expect("insert failed");
    delete_sample(&conn, "/samples/kick.wav").expect("delete failed");
    assert!(search_samples(&conn, "kick")
        .expect("search failed")
        .is_empty());
}

#[test]
fn test_delete_nonexistent_returns_zero() {
    let conn = setup_db();
    assert_eq!(
        delete_sample(&conn, "/nonexistent.wav").expect("delete failed"),
        0
    );
}

#[test]
fn test_delete_sample_removes_tags() {
    let conn = setup_db();
    let id =
        insert_sample(&conn, &make_input("/samples/kick.wav", "kick.wav")).expect("insert failed");
    conn.execute("INSERT INTO tags (name) VALUES ('drums')", [])
        .expect("tag insert failed");
    conn.execute(
        "INSERT INTO sample_tags (sample_id, tag_id) VALUES (?1, 1)",
        params![id],
    )
    .expect("sample_tag insert failed");
    delete_sample(&conn, "/samples/kick.wav").expect("delete failed");
    let tag_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM sample_tags WHERE sample_id = ?1",
            params![id],
            |row| row.get(0),
        )
        .expect("count failed");
    assert_eq!(tag_count, 0);
}

#[test]
fn test_insert_search_update_delete_roundtrip() {
    let conn = setup_db();
    let input = make_input("/samples/kick_808.wav", "kick_808.wav");
    let id = insert_sample(&conn, &input).expect("insert failed");
    assert!(id > 0);
    assert_eq!(
        search_samples(&conn, "kick").expect("search failed").len(),
        1
    );
    update_sample(
        &conn,
        &SampleInput {
            bpm: Some(140.0),
            ..input.clone()
        },
    )
    .expect("update failed");
    assert_eq!(
        get_sample_by_path(&conn, "/samples/kick_808.wav")
            .expect("get failed")
            .expect("not found")
            .bpm,
        Some(140.0)
    );
    delete_sample(&conn, "/samples/kick_808.wav").expect("delete failed");
    assert!(get_sample_by_path(&conn, "/samples/kick_808.wav")
        .expect("get failed")
        .is_none());
    assert!(search_samples(&conn, "kick")
        .expect("search failed")
        .is_empty());
}

#[test]
fn test_move_sample_path_updates_row_and_search_index() {
    let conn = setup_db();
    insert_sample(&conn, &make_input("/samples/old_kick.wav", "old_kick.wav"))
        .expect("insert failed");

    assert_eq!(
        move_sample_path(&conn, "/samples/old_kick.wav", "/samples/moved/new_kick.wav")
            .expect("move failed"),
        1
    );

    assert!(get_sample_by_path(&conn, "/samples/old_kick.wav")
        .expect("old path lookup failed")
        .is_none());
    let moved = get_sample_by_path(&conn, "/samples/moved/new_kick.wav")
        .expect("new path lookup failed")
        .expect("moved sample not found");
    assert_eq!(moved.file_name, "new_kick.wav");

    assert!(search_samples(&conn, "old_kick")
        .expect("old search failed")
        .is_empty());
    let results = search_samples(&conn, "new_kick").expect("new search failed");
    assert_eq!(results.len(), 1);
    assert_eq!(results[0].path, "/samples/moved/new_kick.wav");
}

#[test]
fn test_clear_all_samples_removes_rows_tags_and_search_entries() {
    let conn = setup_db();
    let first_id = insert_sample(&conn, &make_input("/samples/clear-kick.wav", "clear-kick.wav"))
        .expect("first insert failed");
    insert_sample(&conn, &make_input("/samples/clear-snare.wav", "clear-snare.wav"))
        .expect("second insert failed");
    conn.execute("INSERT INTO tags (name) VALUES ('phase2-clear')", [])
        .expect("tag insert failed");
    conn.execute(
        "INSERT INTO sample_tags (sample_id, tag_id) VALUES (?1, 1)",
        params![first_id],
    )
    .expect("sample tag insert failed");

    assert_eq!(clear_all_samples(&conn).expect("clear failed"), 2);

    let sample_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM samples", [], |row| row.get(0))
        .expect("sample count failed");
    let sample_tag_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM sample_tags", [], |row| row.get(0))
        .expect("sample tag count failed");
    let fts_count: i64 = conn
        .query_row("SELECT COUNT(*) FROM samples_fts", [], |row| row.get(0))
        .expect("fts count failed");

    assert_eq!(sample_count, 0);
    assert_eq!(sample_tag_count, 0);
    assert_eq!(fts_count, 0);
    assert!(search_samples(&conn, "clear")
        .expect("search after clear failed")
        .is_empty());
}
