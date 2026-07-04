use rusqlite::params;

use crate::db::operations::{insert_sample, search_samples, search_samples_paginated};

use super::{make_input, setup_db};

#[test]
fn test_search_samples_basic_match() {
    let conn = setup_db();
    insert_sample(&conn, &make_input("/samples/kick_808.wav", "kick_808.wav"))
        .expect("insert failed");
    insert_sample(
        &conn,
        &make_input("/samples/snare_tight.wav", "snare_tight.wav"),
    )
    .expect("insert failed");
    let results = search_samples(&conn, "kick").expect("search failed");
    assert_eq!(results.len(), 1);
    assert_eq!(results[0].file_name, "kick_808.wav");
}

#[test]
fn test_search_samples_no_match() {
    let conn = setup_db();
    insert_sample(&conn, &make_input("/samples/kick.wav", "kick.wav")).expect("insert failed");
    assert!(search_samples(&conn, "cymbal")
        .expect("search failed")
        .is_empty());
}

#[test]
fn test_search_samples_fuzzy_subsequence_match() {
    let conn = setup_db();
    insert_sample(&conn, &make_input("/samples/kick_808.wav", "kick_808.wav"))
        .expect("insert failed");
    insert_sample(&conn, &make_input("/samples/kick_909.wav", "kick_909.wav"))
        .expect("insert failed");
    insert_sample(&conn, &make_input("/samples/snare.wav", "snare.wav")).expect("insert failed");
    assert_eq!(search_samples(&conn, "kc").expect("search failed").len(), 2);
}

#[test]
fn test_search_samples_normalizes_full_width_ascii_and_spaces() {
    let conn = setup_db();
    insert_sample(
        &conn,
        &make_input("/samples/kick_loop.wav", "kick_loop.wav"),
    )
    .expect("insert failed");
    let results = search_samples(&conn, "ｋｉｃｋ\u{3000}ｌｏｏｐ").expect("search failed");
    assert_eq!(results.len(), 1);
    assert_eq!(results[0].file_name, "kick_loop.wav");
}

#[test]
fn test_search_samples_matches_sample_tags() {
    let conn = setup_db();
    let sample_id = insert_sample(&conn, &make_input("/samples/mystery.wav", "mystery.wav"))
        .expect("insert failed");
    conn.execute("INSERT INTO tags (name) VALUES ('drums')", [])
        .expect("tag insert failed");
    conn.execute(
        "INSERT INTO sample_tags (sample_id, tag_id) VALUES (?1, 1)",
        params![sample_id],
    )
    .expect("sample tag insert failed");

    let results = search_samples(&conn, "drm").expect("search failed");
    assert_eq!(results.len(), 1);
    assert_eq!(results[0].file_name, "mystery.wav");
    assert_eq!(results[0].tags, vec!["drums"]);
}

#[test]
fn test_search_samples_paginated_applies_offset_after_fuzzy_filter() {
    let conn = setup_db();
    insert_sample(
        &conn,
        &make_input("/samples/alpha_kick.wav", "alpha_kick.wav"),
    )
    .expect("insert failed");
    insert_sample(
        &conn,
        &make_input("/samples/beta_kick.wav", "beta_kick.wav"),
    )
    .expect("insert failed");
    insert_sample(
        &conn,
        &make_input("/samples/gamma_kick.wav", "gamma_kick.wav"),
    )
    .expect("insert failed");
    insert_sample(&conn, &make_input("/samples/snare.wav", "snare.wav")).expect("insert failed");

    let page = search_samples_paginated(&conn, "kick", 1, 1, None).expect("search page failed");
    assert_eq!(page.len(), 1);
    assert_eq!(page[0].file_name, "beta_kick.wav");
}

#[test]
fn test_search_samples_multiple_terms() {
    let conn = setup_db();
    insert_sample(&conn, &make_input("/samples/kick_808.wav", "kick_808.wav"))
        .expect("insert failed");
    insert_sample(
        &conn,
        &make_input("/samples/snare_808.wav", "snare_808.wav"),
    )
    .expect("insert failed");
    let results = search_samples(&conn, "kick 808").expect("search failed");
    assert_eq!(results.len(), 1);
    assert_eq!(results[0].file_name, "kick_808.wav");
}

#[test]
fn test_search_samples_empty_query_returns_all_samples() {
    let conn = setup_db();
    insert_sample(&conn, &make_input("/samples/kick.wav", "kick.wav")).expect("insert failed");
    insert_sample(&conn, &make_input("/samples/snare.wav", "snare.wav")).expect("insert failed");
    assert_eq!(search_samples(&conn, "").expect("search failed").len(), 2);
    assert_eq!(
        search_samples(&conn, "   \t\n")
            .expect("search failed")
            .len(),
        2
    );
}

#[test]
fn test_search_samples_special_chars_do_not_error() {
    let conn = setup_db();
    insert_sample(&conn, &make_input("/samples/kick.wav", "kick.wav")).expect("insert failed");
    assert!(search_samples(&conn, "(")
        .expect("search failed")
        .is_empty());
    assert!(search_samples(&conn, "\"")
        .expect("search failed")
        .is_empty());
}
