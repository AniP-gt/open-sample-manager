use std::fs::File;

use tempfile::TempDir;

use super::super::audio::extract_artist;
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
fn search_fuzzy_subsequence_matching() {
    let dir = TempDir::new().unwrap();
    write_wav(&dir, "kick_808.wav", 11_025);
    write_wav(&dir, "kick_909.wav", 11_025);
    write_wav(&dir, "snare.wav", 11_025);

    let manager = make_manager();
    manager.scan_directory(dir.path()).expect("scan failed");

    let results = manager.search("kc").expect("search failed");
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
