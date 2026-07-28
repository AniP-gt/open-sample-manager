use rusqlite::params;

use crate::db::operations::{insert_sample, search_samples, search_samples_paginated};

use super::{make_input, setup_db};

fn tagged_sample(conn: &rusqlite::Connection, sample_id: i64, tag_name: &str) {
    conn.execute(
        "INSERT OR IGNORE INTO tags (name) VALUES (?1)",
        params![tag_name],
    )
    .expect("tag insert failed");
    let tag_id: i64 = conn
        .query_row(
            "SELECT id FROM tags WHERE name = ?1",
            params![tag_name],
            |row| row.get(0),
        )
        .expect("tag lookup failed");
    conn.execute(
        "INSERT INTO sample_tags (sample_id, tag_id) VALUES (?1, ?2)",
        params![sample_id, tag_id],
    )
    .expect("sample tag insert failed");
}

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
fn test_search_samples_fuzzy_contiguous_match() {
    let conn = setup_db();
    insert_sample(&conn, &make_input("/samples/kick_808.wav", "kick_808.wav"))
        .expect("insert failed");
    insert_sample(&conn, &make_input("/samples/kick_909.wav", "kick_909.wav"))
        .expect("insert failed");
    insert_sample(&conn, &make_input("/samples/snare.wav", "snare.wav")).expect("insert failed");
    assert_eq!(
        search_samples(&conn, "kick").expect("search failed").len(),
        2
    );
    assert!(search_samples(&conn, "kc")
        .expect("search failed")
        .is_empty());
}

#[test]
fn test_search_samples_fill_matches_contiguous_terms_and_not_noncontiguous_legacy_match() {
    let conn = setup_db();
    insert_sample(
        &conn,
        &make_input("/samples/Drum Fill.wav", "Drum Fill.wav"),
    )
    .expect("insert failed");
    insert_sample(
        &conn,
        &make_input(
            "/samples/FL_PV2022_VP_Kit04_Fx_Loop_Delayed_Impact_143_Amin_02.wav",
            "FL_PV2022_VP_Kit04_Fx_Loop_Delayed_Impact_143_Amin_02.wav",
        ),
    )
    .expect("insert failed");

    let results = search_samples(&conn, "fill").expect("search failed");
    assert_eq!(results.len(), 1);
    assert_eq!(results[0].file_name, "Drum Fill.wav");
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

    let results = search_samples(&conn, "drum").expect("search failed");
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

#[test]
fn test_search_samples_supports_advanced_dsl_fields() {
    let conn = setup_db();
    let mut kick = make_input("/samples/metal_kick.wav", "metal_kick.wav");
    kick.bpm = Some(140.0);
    kick.playback_type = Some("oneshot".to_string());
    kick.instrument_type = Some("kick".to_string());
    kick.musical_key = Some("A".to_string());
    let kick_id = insert_sample(&conn, &kick).expect("insert kick failed");
    tagged_sample(&conn, kick_id, "metal");

    let mut snare = make_input("/samples/metal_snare.wav", "metal_snare.wav");
    snare.bpm = Some(95.0);
    snare.playback_type = Some("oneshot".to_string());
    snare.instrument_type = Some("snare".to_string());
    snare.musical_key = Some("C".to_string());
    let snare_id = insert_sample(&conn, &snare).expect("insert snare failed");
    tagged_sample(&conn, snare_id, "metal");

    let results = search_samples(
        &conn,
        "kick bpm:120-180 type:one-shot instrument:kick key:Am tag:metal",
    )
    .expect("search failed");

    assert_eq!(results.len(), 1);
    assert_eq!(results[0].file_name, "metal_kick.wav");
}

#[test]
fn test_search_samples_supports_negative_terms_and_tags() {
    let conn = setup_db();
    let clean_id = insert_sample(&conn, &make_input("/samples/snare.wav", "snare.wav"))
        .expect("insert clean failed");
    tagged_sample(&conn, clean_id, "drums");
    let rimshot_id = insert_sample(
        &conn,
        &make_input("/samples/snare_rimshot.wav", "snare_rimshot.wav"),
    )
    .expect("insert rimshot failed");
    tagged_sample(&conn, rimshot_id, "rimshot");

    let results = search_samples(&conn, "snare -rimshot -tag:rimshot").expect("search failed");

    assert_eq!(results.len(), 1);
    assert_eq!(results[0].file_name, "snare.wav");
}

#[test]
fn test_search_samples_ignores_frontend_only_favorite_clause() {
    let conn = setup_db();
    insert_sample(&conn, &make_input("/samples/kick.wav", "kick.wav")).expect("insert failed");

    let results = search_samples(&conn, "favorite:true").expect("search failed");

    assert_eq!(results.len(), 1);
    assert_eq!(results[0].file_name, "kick.wav");
}
