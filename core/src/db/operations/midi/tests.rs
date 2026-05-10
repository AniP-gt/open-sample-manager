use rusqlite::Connection;

use crate::db::operations::MidiInput;
use crate::db::schema::init_database;

use super::{
    assign_midi_tag, clear_all_midis, get_tags_for_midi, insert_midi, insert_midi_tag,
    list_midis_paginated, search_midis, search_midis_paginated, set_midi_tag,
};

fn setup_db() -> Connection {
    let conn = Connection::open_in_memory().expect("failed to create in-memory DB");
    init_database(&conn).expect("failed to initialize schema");
    conn
}

fn midi_input(path: &str, file_name: &str) -> MidiInput {
    MidiInput {
        path: path.to_string(),
        file_name: file_name.to_string(),
        duration: None,
        tempo: None,
        time_signature_numerator: None,
        time_signature_denominator: None,
        track_count: None,
        note_count: None,
        channel_count: None,
        key_estimate: None,
        file_size: None,
    }
}

fn count_rows(conn: &Connection, table: &str) -> i64 {
    conn.query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |row| {
        row.get(0)
    })
    .expect("count query failed")
}

#[test]
fn clear_all_midis_removes_rows_fts_and_file_tags() {
    let conn = setup_db();
    let first_id = insert_midi(&conn, &midi_input("/midis/clear-one.mid", "clear-one.mid"))
        .expect("first midi insert failed");
    let second_id = insert_midi(&conn, &midi_input("/midis/clear-two.mid", "clear-two.mid"))
        .expect("second midi insert failed");
    let tag_id = insert_midi_tag(&conn, "phase3-clear").expect("tag insert failed");
    assign_midi_tag(&conn, first_id, tag_id).expect("first tag assign failed");
    assign_midi_tag(&conn, second_id, tag_id).expect("second tag assign failed");

    assert_eq!(clear_all_midis(&conn).expect("clear midis failed"), 2);

    assert_eq!(count_rows(&conn, "midis"), 0);
    assert_eq!(count_rows(&conn, "midis_fts"), 0);
    assert_eq!(count_rows(&conn, "midi_file_tags"), 0);
    assert!(search_midis(&conn, "clear")
        .expect("search after clear failed")
        .is_empty());
    assert_eq!(clear_all_midis(&conn).expect("empty clear failed"), 0);
}

#[test]
fn set_midi_tag_attaches_removes_and_replaces_single_tag() {
    let conn = setup_db();
    let midi_id = insert_midi(&conn, &midi_input("/midis/tagged.mid", "tagged.mid"))
        .expect("midi insert failed");
    let melody_id = insert_midi_tag(&conn, "phase3-melody").expect("melody tag insert failed");
    let bass_id = insert_midi_tag(&conn, "phase3-bass").expect("bass tag insert failed");

    set_midi_tag(&conn, midi_id, Some(melody_id)).expect("set melody tag failed");
    let tags = get_tags_for_midi(&conn, midi_id).expect("get melody tags failed");
    assert_eq!(tags.len(), 1);
    assert_eq!(tags[0].name, "phase3-melody");
    assert_eq!(
        search_midis(&conn, "melody")
            .expect("search melody failed")
            .len(),
        1
    );

    set_midi_tag(&conn, midi_id, Some(bass_id)).expect("replace tag failed");
    let replaced = get_tags_for_midi(&conn, midi_id).expect("get replaced tags failed");
    assert_eq!(replaced.len(), 1);
    assert_eq!(replaced[0].name, "phase3-bass");
    assert!(search_midis(&conn, "melody")
        .expect("search old tag failed")
        .is_empty());
    assert_eq!(
        search_midis(&conn, "bass")
            .expect("search replacement tag failed")
            .len(),
        1
    );

    set_midi_tag(&conn, midi_id, None).expect("remove tag failed");
    assert!(get_tags_for_midi(&conn, midi_id)
        .expect("get removed tags failed")
        .is_empty());
    assert!(search_midis(&conn, "bass")
        .expect("search removed tag failed")
        .is_empty());
}

#[test]
fn set_midi_tag_rejects_missing_ids_by_current_sqlite_contract() {
    let conn = setup_db();
    let midi_id = insert_midi(
        &conn,
        &midi_input("/midis/missing-contract.mid", "missing.mid"),
    )
    .expect("midi insert failed");
    let tag_id = insert_midi_tag(&conn, "phase3-contract").expect("tag insert failed");

    assert!(
        set_midi_tag(&conn, -1, Some(tag_id)).is_err(),
        "missing midi id should fail the foreign key constraint"
    );
    assert!(
        set_midi_tag(&conn, midi_id, Some(-1)).is_err(),
        "missing tag id should fail the foreign key constraint"
    );

    assert!(get_tags_for_midi(&conn, midi_id)
        .expect("get tags failed")
        .is_empty());
    assert_eq!(count_rows(&conn, "midi_file_tags"), 0);
}

#[test]
fn midi_search_matches_and_ignores_tags_after_removal_with_pagination() {
    let conn = setup_db();
    let alpha_id = insert_midi(&conn, &midi_input("/midis/alpha.mid", "alpha.mid"))
        .expect("alpha insert failed");
    let beta_id =
        insert_midi(&conn, &midi_input("/midis/beta.mid", "beta.mid")).expect("beta insert failed");
    let gamma_id = insert_midi(&conn, &midi_input("/midis/gamma.mid", "gamma.mid"))
        .expect("gamma insert failed");
    let tag_id = insert_midi_tag(&conn, "phase3-loop").expect("tag insert failed");

    set_midi_tag(&conn, alpha_id, Some(tag_id)).expect("alpha tag failed");
    set_midi_tag(&conn, beta_id, Some(tag_id)).expect("beta tag failed");
    set_midi_tag(&conn, gamma_id, Some(tag_id)).expect("gamma tag failed");
    set_midi_tag(&conn, alpha_id, None).expect("alpha tag removal failed");

    let page =
        search_midis_paginated(&conn, "loop", 1, 1, None, None).expect("tag page search failed");
    assert_eq!(page.len(), 1);
    assert_eq!(page[0].file_name, "gamma.mid");

    let all_matches = search_midis(&conn, "loop").expect("tag search failed");
    let file_names: Vec<&str> = all_matches
        .iter()
        .map(|row| row.file_name.as_str())
        .collect();
    assert_eq!(file_names, vec!["beta.mid", "gamma.mid"]);
}

#[test]
fn midi_list_tag_filter_applies_before_pagination() {
    let conn = setup_db();
    insert_midi(&conn, &midi_input("/midis/alpha.mid", "alpha.mid")).expect("alpha insert failed");
    let beta_id =
        insert_midi(&conn, &midi_input("/midis/beta.mid", "beta.mid")).expect("beta insert failed");
    insert_midi(&conn, &midi_input("/midis/gamma.mid", "gamma.mid")).expect("gamma insert failed");
    let delta_id = insert_midi(&conn, &midi_input("/midis/delta.mid", "delta.mid"))
        .expect("delta insert failed");
    let drums_id = insert_midi_tag(&conn, "phase3-drums").expect("drums tag insert failed");

    set_midi_tag(&conn, beta_id, Some(drums_id)).expect("beta tag failed");
    set_midi_tag(&conn, delta_id, Some(drums_id)).expect("delta tag failed");

    let page = list_midis_paginated(&conn, 1, 1, None, Some(drums_id))
        .expect("tag-filtered list page failed");

    assert_eq!(page.len(), 1);
    assert_eq!(page[0].file_name, "delta.mid");
}

#[test]
fn midi_search_tag_filter_applies_before_fuzzy_pagination() {
    let conn = setup_db();
    let alpha_id = insert_midi(
        &conn,
        &midi_input("/midis/alpha_kick.mid", "alpha_kick.mid"),
    )
    .expect("alpha insert failed");
    let beta_id = insert_midi(&conn, &midi_input("/midis/beta_kick.mid", "beta_kick.mid"))
        .expect("beta insert failed");
    let gamma_id = insert_midi(
        &conn,
        &midi_input("/midis/gamma_kick.mid", "gamma_kick.mid"),
    )
    .expect("gamma insert failed");
    let drums_id = insert_midi_tag(&conn, "phase3-drums").expect("drums tag insert failed");
    let bass_id = insert_midi_tag(&conn, "phase3-bass").expect("bass tag insert failed");

    set_midi_tag(&conn, alpha_id, Some(drums_id)).expect("alpha tag failed");
    set_midi_tag(&conn, beta_id, Some(bass_id)).expect("beta tag failed");
    set_midi_tag(&conn, gamma_id, Some(drums_id)).expect("gamma tag failed");

    let page = search_midis_paginated(&conn, "kick", 1, 1, None, Some(drums_id))
        .expect("tag-filtered search page failed");

    assert_eq!(page.len(), 1);
    assert_eq!(page[0].file_name, "gamma_kick.mid");
}
