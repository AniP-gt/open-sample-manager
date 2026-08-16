use std::fs::File;

use rusqlite::Connection;
use tempfile::TempDir;

use crate::db::operations::{insert_sample, SampleInput};

use super::super::audio::extract_artist;
use super::super::SimilarityError;
use super::helpers::{make_manager, write_wav, write_wav_with_artist};

#[test]
fn scan_directory_discovers_and_stores_samples() {
    let dir = TempDir::new().unwrap();
    write_wav(&dir, "kick.wav", 11_025);
    write_wav(&dir, "snare.wav", 11_025);
    File::create(dir.path().join("readme.txt")).unwrap();

    let manager = make_manager();
    let count = manager.scan_directory(dir.path()).expect("scan failed");
    assert_eq!(count, 2, "should have scanned 2 audio files");
}

#[test]
fn scan_empty_directory_returns_zero() {
    let dir = TempDir::new().unwrap();
    let manager = make_manager();
    let count = manager.scan_directory(dir.path()).expect("scan failed");
    assert_eq!(count, 0);
}

#[test]
fn scan_nonexistent_directory_returns_zero() {
    let manager = make_manager();
    let count = manager
        .scan_directory("/tmp/__definitely_nonexistent_dir__")
        .expect("scan failed");
    assert_eq!(count, 0);
}

#[test]
fn get_sample_after_scan() {
    let dir = TempDir::new().unwrap();
    let wav_path = write_wav(&dir, "kick_808.wav", 11_025);

    let manager = make_manager();
    manager.scan_directory(dir.path()).expect("scan failed");

    let sample = manager
        .get_sample(wav_path.to_str().unwrap())
        .expect("get_sample failed")
        .expect("sample not found");

    assert_eq!(sample.file_name, "kick_808.wav");
    assert!(sample.duration.is_some());
    assert!(sample.bpm.is_some());
    assert!(sample.sample_type.is_some());
}

#[test]
fn get_sample_not_found() {
    let manager = make_manager();
    let result = manager
        .get_sample("/nonexistent/path.wav")
        .expect("get_sample failed");
    assert!(result.is_none());
}

#[test]
fn search_finds_matching_samples() {
    let dir = TempDir::new().unwrap();
    write_wav(&dir, "kick_808.wav", 11_025);
    write_wav(&dir, "snare_tight.wav", 11_025);

    let manager = make_manager();
    manager.scan_directory(dir.path()).expect("scan failed");

    let results = manager.search("kick").expect("search failed");
    assert_eq!(results.len(), 1);
    assert_eq!(results[0].file_name, "kick_808.wav");
}

#[test]
fn search_no_match_returns_empty() {
    let dir = TempDir::new().unwrap();
    write_wav(&dir, "kick.wav", 11_025);

    let manager = make_manager();
    manager.scan_directory(dir.path()).expect("scan failed");

    let results = manager.search("cymbal").expect("search failed");
    assert!(results.is_empty());
}

#[test]
fn analyze_file_returns_metadata() {
    let dir = TempDir::new().unwrap();
    let wav_path = write_wav(&dir, "test_sample.wav", 11_025);

    let manager = make_manager();
    let input = manager.analyze_file(&wav_path).expect("analyze failed");

    assert_eq!(input.file_name, "test_sample.wav");
    assert!(input.duration.is_some());
    assert!(input.bpm.is_some());
    assert!(input.sample_type.is_some());
    assert!(input.peak_db.is_some());
    assert!(input.rms_db.is_some());
    assert_eq!(input.channel_count, Some(1));
    assert_eq!(input.bit_depth, Some(16));
    assert!(input.quality_flags.is_some());
}

#[test]
fn extract_artist_from_info_list() {
    let dir = TempDir::new().unwrap();
    let wav_path = write_wav_with_artist(&dir, "with_artist.wav", 11_025, "Unit Test Artist");

    let artist = extract_artist(wav_path.as_path());
    assert_eq!(artist, Some("Unit Test Artist".to_string()));
}

#[test]
fn scan_skips_duplicate_paths() {
    let dir = TempDir::new().unwrap();
    write_wav(&dir, "kick.wav", 11_025);

    let manager = make_manager();
    let count1 = manager.scan_directory(dir.path()).expect("scan 1 failed");
    let count2 = manager.scan_directory(dir.path()).expect("scan 2 failed");

    assert_eq!(count1, 1, "first scan should insert 1");
    assert_eq!(count2, 0, "second scan should skip duplicates");
}

#[test]
fn search_fuzzy_contiguous_matching() {
    let dir = TempDir::new().unwrap();
    write_wav(&dir, "kick_808.wav", 11_025);
    write_wav(&dir, "kick_909.wav", 11_025);
    write_wav(&dir, "snare.wav", 11_025);

    let manager = make_manager();
    manager.scan_directory(dir.path()).expect("scan failed");

    let results = manager.search("kick").expect("search failed");
    assert_eq!(results.len(), 2);
}

#[test]
fn manager_update_sample_classification_persists_fields() {
    let dir = TempDir::new().unwrap();
    let wav_path = write_wav(&dir, "classify_me.wav", 11_025);
    let path = wav_path.to_str().expect("utf8 path");
    let manager = make_manager();
    manager.scan_directory(dir.path()).expect("scan failed");

    assert_eq!(
        manager
            .update_sample_classification(
                None,
                Some(path),
                Some("loop".to_string()),
                Some("synth".to_string()),
            )
            .expect("classification update failed"),
        1
    );
    let sample = manager
        .get_sample(path)
        .expect("get sample failed")
        .expect("sample missing");
    assert_eq!(sample.playback_type, "loop");
    assert_eq!(sample.instrument_type, "synth");
    assert_eq!(sample.sample_type.as_deref(), Some("loop"));

    assert_eq!(
        manager
            .update_sample_classification(
                Some(-1),
                None,
                Some("oneshot".to_string()),
                Some("kick".to_string()),
            )
            .expect("missing classification update failed"),
        0
    );
}

#[test]
fn manager_bulk_instrument_update_is_atomic() {
    let dir = TempDir::new().unwrap();
    write_wav(&dir, "bulk_kick.wav", 11_025);
    write_wav(&dir, "bulk_snare.wav", 11_025);
    let mut manager = make_manager();
    manager.scan_directory(dir.path()).expect("scan failed");
    let samples = manager.search("bulk").expect("search failed");
    assert_eq!(samples.len(), 2);

    let assignments = samples
        .iter()
        .map(|sample| (sample.id, "percussion".to_string()))
        .collect::<Vec<_>>();
    assert_eq!(
        manager
            .update_sample_instrument_types(&assignments)
            .expect("bulk update failed"),
        2
    );
    assert!(manager
        .search("bulk")
        .unwrap()
        .iter()
        .all(|sample| sample.instrument_type == "percussion"));

    let invalid = vec![
        (samples[0].id, "kick".to_string()),
        (samples[1].id, "not-registered".to_string()),
    ];
    assert!(manager.update_sample_instrument_types(&invalid).is_err());
    assert!(manager
        .search("bulk")
        .unwrap()
        .iter()
        .all(|sample| sample.instrument_type == "percussion"));
}

#[test]
fn manager_move_sample_moves_file_and_updates_database() {
    let dir = TempDir::new().unwrap();
    let old_path = write_wav(&dir, "old_move.wav", 11_025);
    let new_path = dir.path().join("new_move.wav");
    let manager = make_manager();
    manager.scan_directory(dir.path()).expect("scan failed");

    let moved = manager
        .move_sample(
            old_path.to_str().expect("utf8 old path"),
            new_path.to_str().expect("utf8 new path"),
        )
        .expect("move sample failed");

    assert_eq!(moved, new_path.to_string_lossy());
    assert!(!old_path.exists());
    assert!(new_path.exists());
    assert!(manager
        .get_sample(old_path.to_str().expect("utf8 old path"))
        .expect("old sample lookup failed")
        .is_none());
    let sample = manager
        .get_sample(new_path.to_str().expect("utf8 new path"))
        .expect("new sample lookup failed")
        .expect("moved sample missing");
    assert_eq!(sample.file_name, "new_move.wav");
}

#[test]
fn manager_update_sample_license_metadata_normalizes_blanks() {
    let dir = TempDir::new().unwrap();
    let wav_path = write_wav(&dir, "license.wav", 11_025);
    let path = wav_path.to_str().expect("utf8 path");
    let manager = make_manager();
    manager.scan_directory(dir.path()).expect("scan failed");

    assert_eq!(
        manager
            .update_sample_license_metadata(
                path,
                Some("  source  ".to_string()),
                Some("".to_string()),
                Some("MIT".to_string()),
                Some("  ".to_string()),
                Some("memo".to_string()),
            )
            .expect("license update failed"),
        1
    );

    let sample = manager
        .get_sample(path)
        .expect("get sample failed")
        .expect("sample missing");
    assert_eq!(sample.source.as_deref(), Some("source"));
    assert_eq!(sample.pack_name, None);
    assert_eq!(sample.license.as_deref(), Some("MIT"));
    assert_eq!(sample.license_url, None);
    assert_eq!(sample.license_memo.as_deref(), Some("memo"));
}

fn encode_embedding(values: &[f32]) -> Vec<u8> {
    values
        .iter()
        .flat_map(|value| value.to_le_bytes())
        .collect()
}

fn make_similarity_input(
    path: &str,
    file_name: &str,
    embedding: Option<Vec<u8>>,
    content_hash: Option<&str>,
) -> SampleInput {
    SampleInput {
        path: path.to_string(),
        file_name: file_name.to_string(),
        duration: Some(1.0),
        bpm: Some(120.0),
        periodicity: Some(0.5),
        sample_rate: Some(44_100),
        file_size: Some(1_024),
        artist: None,
        low_ratio: None,
        attack_slope: None,
        decay_time: None,
        sample_type: Some("oneshot".to_string()),
        waveform_peaks: None,
        embedding,
        source: None,
        pack_name: None,
        license: None,
        license_url: None,
        license_memo: None,
        imported_at: None,
        peak_db: None,
        rms_db: None,
        leading_silence_ms: None,
        clipping_count: None,
        channel_count: Some(1),
        bit_depth: Some(16),
        quality_flags: None,
        playback_type: Some("oneshot".to_string()),
        instrument_type: Some("other".to_string()),
        musical_key: None,
        content_hash: content_hash.map(|value| value.to_string()),
    }
}

fn setup_similarity_manager() -> (TempDir, super::super::SampleManager, Connection) {
    let dir = TempDir::new().expect("tempdir");
    let db_path = dir.path().join("similarity.db");
    let manager = super::super::SampleManager::new(Some(db_path.to_str().expect("utf8 db path")))
        .expect("manager");
    let conn = Connection::open(&db_path).expect("open shared db");
    (dir, manager, conn)
}

fn insert_similarity_sample(
    conn: &Connection,
    path: &str,
    file_name: &str,
    embedding: Option<Vec<u8>>,
    content_hash: Option<&str>,
) -> i64 {
    insert_sample(
        conn,
        &make_similarity_input(path, file_name, embedding, content_hash),
    )
    .expect("insert sample")
}

#[test]
fn manager_similarity_by_id_returns_inserted_row_by_id() {
    let (_dir, manager, conn) = setup_similarity_manager();
    let id = insert_similarity_sample(
        &conn,
        "/samples/kick.wav",
        "kick.wav",
        Some(encode_embedding(&[1.0, 0.0, 0.0])),
        None,
    );

    let row = manager
        .get_sample_by_id(id)
        .expect("lookup failed")
        .expect("sample missing");

    assert_eq!(row.id, id);
    assert_eq!(row.path, "/samples/kick.wav");
}

#[test]
fn manager_similarity_by_id_returns_none_for_missing_row() {
    let manager = make_manager();

    assert!(manager
        .get_sample_by_id(-1)
        .expect("lookup failed")
        .is_none());
}

#[test]
fn manager_similarity_by_id_excludes_source_row_and_orders_descending() {
    let (_dir, manager, conn) = setup_similarity_manager();
    let source_id = insert_similarity_sample(
        &conn,
        "/samples/source.wav",
        "source.wav",
        Some(encode_embedding(&[1.0, 0.0, 0.0])),
        Some("hash-source"),
    );
    insert_similarity_sample(
        &conn,
        "/samples/high.wav",
        "high.wav",
        Some(encode_embedding(&[0.9, 0.1, 0.0])),
        Some("hash-high"),
    );
    insert_similarity_sample(
        &conn,
        "/samples/low.wav",
        "low.wav",
        Some(encode_embedding(&[0.1, 0.9, 0.0])),
        Some("hash-low"),
    );

    let results = manager
        .find_similar_samples(source_id, 5, false)
        .expect("similarity lookup failed");

    assert_eq!(results.len(), 2);
    assert!(results.iter().all(|result| result.row.id != source_id));
    assert_eq!(results[0].row.path, "/samples/high.wav");
    assert_eq!(results[1].row.path, "/samples/low.wav");
    assert!(results[0].similarity > results[1].similarity);
}

#[test]
fn manager_similarity_by_id_excludes_duplicates_when_requested() {
    let (_dir, manager, conn) = setup_similarity_manager();
    let source_id = insert_similarity_sample(
        &conn,
        "/samples/source.wav",
        "source.wav",
        Some(encode_embedding(&[1.0, 0.0, 0.0])),
        Some("shared-hash"),
    );
    insert_similarity_sample(
        &conn,
        "/samples/duplicate.wav",
        "duplicate.wav",
        Some(encode_embedding(&[0.95, 0.05, 0.0])),
        Some("shared-hash"),
    );
    insert_similarity_sample(
        &conn,
        "/samples/unique.wav",
        "unique.wav",
        Some(encode_embedding(&[0.2, 0.8, 0.0])),
        Some("unique-hash"),
    );

    let results = manager
        .find_similar_samples(source_id, 5, true)
        .expect("similarity lookup failed");

    assert_eq!(results.len(), 1);
    assert_eq!(results[0].row.path, "/samples/unique.wav");
}

#[test]
fn manager_similarity_by_id_respects_limit() {
    let (_dir, manager, conn) = setup_similarity_manager();
    let source_id = insert_similarity_sample(
        &conn,
        "/samples/source.wav",
        "source.wav",
        Some(encode_embedding(&[1.0, 0.0, 0.0])),
        None,
    );
    insert_similarity_sample(
        &conn,
        "/samples/one.wav",
        "one.wav",
        Some(encode_embedding(&[0.9, 0.1, 0.0])),
        None,
    );
    insert_similarity_sample(
        &conn,
        "/samples/two.wav",
        "two.wav",
        Some(encode_embedding(&[0.8, 0.2, 0.0])),
        None,
    );
    insert_similarity_sample(
        &conn,
        "/samples/three.wav",
        "three.wav",
        Some(encode_embedding(&[0.7, 0.3, 0.0])),
        None,
    );

    let results = manager
        .find_similar_samples(source_id, 2, false)
        .expect("similarity lookup failed");

    assert_eq!(results.len(), 2);
    assert_eq!(results[0].row.path, "/samples/one.wav");
    assert_eq!(results[1].row.path, "/samples/two.wav");
}

#[test]
fn manager_similarity_by_id_errors_on_missing_embedding() {
    let (_dir, manager, conn) = setup_similarity_manager();
    let source_id =
        insert_similarity_sample(&conn, "/samples/source.wav", "source.wav", None, None);

    let err = manager
        .find_similar_samples(source_id, 2, false)
        .expect_err("missing embedding should fail");

    assert!(matches!(err, SimilarityError::MissingEmbedding(id) if id == source_id));
}

#[test]
fn manager_similarity_by_id_errors_on_malformed_embedding() {
    let (_dir, manager, conn) = setup_similarity_manager();
    let source_id = insert_similarity_sample(
        &conn,
        "/samples/source.wav",
        "source.wav",
        Some(vec![1, 2, 3]),
        None,
    );

    let err = manager
        .find_similar_samples(source_id, 2, false)
        .expect_err("malformed embedding should fail");

    assert!(matches!(err, SimilarityError::MalformedEmbedding(id) if id == source_id));
}
