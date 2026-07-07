use crate::db::operations::{
    get_sample_by_path, insert_sample, list_duplicate_groups, search_samples, update_sample,
    SampleInput,
};

use super::{make_input, setup_db};

#[test]
fn test_insert_sample_returns_rowid() {
    let conn = setup_db();
    let id = insert_sample(&conn, &make_input("/samples/kick_808.wav", "kick_808.wav"))
        .expect("insert failed");
    assert!(id > 0);
}

#[test]
fn test_insert_sample_duplicate_path_fails() {
    let conn = setup_db();
    let input = make_input("/samples/kick.wav", "kick.wav");
    insert_sample(&conn, &input).expect("first insert failed");
    assert!(
        insert_sample(&conn, &input).is_err(),
        "duplicate path should fail"
    );
}

#[test]
fn test_insert_sample_with_nulls() {
    let conn = setup_db();
    let input = SampleInput {
        path: "/samples/mystery.wav".to_string(),
        file_name: "mystery.wav".to_string(),
        duration: None,
        bpm: None,
        periodicity: None,
        sample_rate: None,
        file_size: None,
        artist: None,
        low_ratio: None,
        attack_slope: None,
        decay_time: None,
        sample_type: None,
        waveform_peaks: None,
        embedding: None,
        playback_type: None,
        instrument_type: None,
        musical_key: None,
        content_hash: None,
    };
    assert!(insert_sample(&conn, &input).expect("insert with nulls failed") > 0);
}

#[test]
fn test_list_duplicate_groups_by_content_hash() {
    let conn = setup_db();
    let first = SampleInput {
        content_hash: Some("abc123".to_string()),
        file_size: Some(10),
        ..make_input("/samples/a.wav", "a.wav")
    };
    let second = SampleInput {
        content_hash: Some("abc123".to_string()),
        file_size: Some(10),
        ..make_input("/other/a-copy.wav", "a-copy.wav")
    };
    let unique = SampleInput {
        content_hash: Some("unique".to_string()),
        ..make_input("/samples/unique.wav", "unique.wav")
    };

    insert_sample(&conn, &first).expect("insert first");
    insert_sample(&conn, &second).expect("insert second");
    insert_sample(&conn, &unique).expect("insert unique");

    let groups = list_duplicate_groups(&conn).expect("list duplicate groups");
    assert_eq!(groups.len(), 1);
    assert_eq!(groups[0].content_hash, "abc123");
    assert_eq!(groups[0].sample_count, 2);
    assert_eq!(groups[0].total_file_size, 20);
    assert_eq!(groups[0].samples.len(), 2);
    assert_eq!(groups[0].samples[0].duplicate_count, 2);
}

#[test]
fn test_get_sample_by_path_found() {
    let conn = setup_db();
    insert_sample(&conn, &make_input("/samples/kick_808.wav", "kick_808.wav"))
        .expect("insert failed");
    let sample = get_sample_by_path(&conn, "/samples/kick_808.wav")
        .expect("query failed")
        .expect("sample not found");
    assert_eq!(sample.path, "/samples/kick_808.wav");
    assert_eq!(sample.bpm, Some(120.0));
    assert!(sample.is_online);
}

#[test]
fn test_get_sample_by_path_not_found() {
    let conn = setup_db();
    assert!(get_sample_by_path(&conn, "/nonexistent.wav")
        .expect("query failed")
        .is_none());
}

#[test]
fn test_update_sample_modifies_fields() {
    let conn = setup_db();
    let input = make_input("/samples/kick.wav", "kick.wav");
    insert_sample(&conn, &input).expect("insert failed");
    let updated_input = SampleInput {
        path: "/samples/kick.wav".to_string(),
        file_name: "kick_renamed.wav".to_string(),
        bpm: Some(140.0),
        sample_type: Some("loop".to_string()),
        embedding: Some(vec![1, 2, 3, 4]),
        ..input
    };
    assert_eq!(
        update_sample(&conn, &updated_input).expect("update failed"),
        1
    );
    let sample = get_sample_by_path(&conn, "/samples/kick.wav")
        .expect("query failed")
        .expect("not found");
    assert_eq!(sample.file_name, "kick_renamed.wav");
    assert_eq!(sample.bpm, Some(140.0));
    assert_eq!(sample.embedding, Some(vec![1, 2, 3, 4]));
}

#[test]
fn test_update_sample_updates_playback_and_instrument() {
    let conn = setup_db();
    let input = make_input("/samples/test.wav", "test.wav");
    insert_sample(&conn, &input).expect("insert failed");
    let updated = SampleInput {
        playback_type: Some("loop".to_string()),
        instrument_type: Some("snare".to_string()),
        ..input.clone()
    };
    assert_eq!(update_sample(&conn, &updated).expect("update failed"), 1);
    let sample = get_sample_by_path(&conn, "/samples/test.wav")
        .expect("query failed")
        .expect("not found");
    assert_eq!(sample.playback_type, "loop");
    assert_eq!(sample.instrument_type, "snare");
}

#[test]
fn test_update_nonexistent_sample_returns_zero() {
    let conn = setup_db();
    assert_eq!(
        update_sample(&conn, &make_input("/nonexistent.wav", "nope.wav")).expect("update failed"),
        0
    );
}

#[test]
fn test_update_sample_updates_search_name() {
    let conn = setup_db();
    let input = make_input("/samples/old_name.wav", "old_name.wav");
    insert_sample(&conn, &input).expect("insert failed");
    update_sample(
        &conn,
        &SampleInput {
            file_name: "new_name.wav".to_string(),
            ..input
        },
    )
    .expect("update failed");
    assert!(search_samples(&conn, "old_name")
        .expect("search failed")
        .is_empty());
    let new_results = search_samples(&conn, "new_name").expect("search failed");
    assert_eq!(new_results.len(), 1);
    assert_eq!(new_results[0].file_name, "new_name.wav");
}
