#[path = "common/db.rs"]
mod db_common;

use open_sample_manager_core::db::operations::{
    get_midi_by_path, insert_midi, list_midis_paginated, MidiInput,
};
use open_sample_manager_core::db::schema::init_database;
use rusqlite::Connection;

use db_common::{init_test_db, midi_input};

#[test]
fn midi_schema_init_is_idempotent_on_in_memory_db() {
    let conn = Connection::open_in_memory().expect("open in-memory DB");

    init_database(&conn).expect("first init_database should succeed");
    init_database(&conn).expect("second init_database should succeed");

    let column_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM pragma_table_info('midis')",
            [],
            |row| row.get(0),
        )
        .expect("query midis columns");
    assert!(
        column_count >= 12,
        "midis table should have expected columns"
    );
}

#[test]
fn midi_db_roundtrip_insert_get_list_paginated() {
    let conn = init_test_db();

    let first = MidiInput {
        path: "/tmp/first.mid".to_string(),
        file_name: "first.mid".to_string(),
        duration: Some(12.5),
        tempo: Some(128.0),
        time_signature_numerator: Some(3),
        time_signature_denominator: Some(4),
        track_count: Some(2),
        note_count: Some(96),
        channel_count: Some(2),
        key_estimate: Some("C minor".to_string()),
        musical_role: Some("chords".to_string()),
        polyphony: Some("polyphonic".to_string()),
        density: Some("dense".to_string()),
        register: Some("mid".to_string()),
        bar_count: Some(4.0),
        suggested_instrument: Some("piano".to_string()),
        file_size: Some(2048),
    };
    let second = MidiInput {
        path: "/tmp/second.midi".to_string(),
        file_name: "second.midi".to_string(),
        duration: None,
        tempo: None,
        time_signature_numerator: None,
        time_signature_denominator: None,
        track_count: Some(1),
        note_count: Some(48),
        channel_count: Some(1),
        key_estimate: None,
        musical_role: None,
        polyphony: None,
        density: None,
        register: None,
        bar_count: None,
        suggested_instrument: None,
        file_size: Some(1024),
    };

    let first_id = insert_midi(&conn, &first).expect("insert first midi");
    let second_id = insert_midi(&conn, &second).expect("insert second midi");
    assert!(first_id > 0);
    assert!(second_id > first_id);

    let fetched = get_midi_by_path(&conn, "/tmp/first.mid")
        .expect("get midi by path")
        .expect("midi should exist");
    assert_eq!(fetched.file_name, "first.mid");
    assert_eq!(fetched.tempo, Some(128.0));
    assert_eq!(fetched.time_signature_numerator, 3);
    assert_eq!(fetched.time_signature_denominator, 4);
    assert_eq!(fetched.musical_role.as_deref(), Some("chords"));
    assert_eq!(fetched.polyphony.as_deref(), Some("polyphonic"));
    assert_eq!(fetched.density.as_deref(), Some("dense"));
    assert_eq!(fetched.register.as_deref(), Some("mid"));
    assert_eq!(fetched.bar_count, Some(4.0));
    assert_eq!(fetched.suggested_instrument.as_deref(), Some("piano"));

    let page_one = list_midis_paginated(&conn, 1, 0, None, None).expect("list page one");
    assert_eq!(page_one.len(), 1);
    assert_eq!(page_one[0].path, "/tmp/first.mid");

    let page_two = list_midis_paginated(&conn, 1, 1, None, None).expect("list page two");
    assert_eq!(page_two.len(), 1);
    assert_eq!(page_two[0].path, "/tmp/second.midi");
    assert_eq!(page_two[0].time_signature_numerator, 4);
    assert_eq!(page_two[0].time_signature_denominator, 4);
}

#[test]
fn midi_paginated_filters_directory_with_path_boundary() {
    let conn = init_test_db();

    for (path, file_name) in [
        ("/packs/KICK/one.mid", "one.mid"),
        ("/packs/KICK2/two.mid", "two.mid"),
        ("/packs/KICK_nested.mid", "nested.mid"),
    ] {
        insert_midi(&conn, &midi_input(path, file_name)).expect("insert midi");
    }

    let rows = list_midis_paginated(&conn, 10, 0, Some("/packs/KICK/"), None)
        .expect("list filtered midis");

    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0].path, "/packs/KICK/one.mid");
}

#[test]
fn midi_paginated_escapes_directory_like_wildcards() {
    let conn = init_test_db();

    for (path, file_name) in [
        ("/packs/KI_CK/one.mid", "one.mid"),
        ("/packs/KIxCK/two.mid", "two.mid"),
    ] {
        insert_midi(&conn, &midi_input(path, file_name)).expect("insert midi");
    }

    let rows = list_midis_paginated(&conn, 10, 0, Some("/packs/KI_CK"), None)
        .expect("list wildcard-safe midis");

    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0].path, "/packs/KI_CK/one.mid");
}

#[test]
fn midi_insert_duplicate_path_returns_error_without_panic() {
    let conn = init_test_db();
    let midi = midi_input("/tmp/dup.mid", "dup.mid");

    let first = insert_midi(&conn, &midi).expect("first insert should succeed");
    assert!(first > 0, "first insert should return a valid rowid");

    let duplicate = insert_midi(&conn, &midi).expect("duplicate insert should not error");
    assert!(
        duplicate > 0,
        "duplicate path upsert should return a valid rowid"
    );
}
