#[path = "common/files.rs"]
mod files_common;

use std::path::Path;

use open_sample_manager_core::scanner::scan_midi_directory;
use open_sample_manager_core::SampleManager;
use tempfile::TempDir;

use files_common::touch_files;

#[test]
fn scan_midi_directory_finds_mid_and_midi_only() {
    let dir = TempDir::new().expect("create temp dir");
    touch_files(
        &dir,
        &[
            "beat.mid",
            "chords.midi",
            "UPPER.MID",
            "noise.wav",
            "notes.txt",
        ],
    );

    let mut found = scan_midi_directory(dir.path())
        .iter()
        .map(|p| {
            p.file_name()
                .expect("file name")
                .to_string_lossy()
                .into_owned()
        })
        .collect::<Vec<_>>();
    found.sort();

    assert_eq!(found, vec!["UPPER.MID", "beat.mid", "chords.midi"]);
}

#[test]
fn manager_scan_midi_directory_happy_path_and_duplicate_error_path() {
    let dir = TempDir::new().expect("create temp dir");
    touch_files(&dir, &["one.mid", "two.midi", "skip.wav"]);

    let manager = SampleManager::new(None).expect("create manager");
    let first_count = manager
        .scan_midi_directory(dir.path())
        .expect("first midi scan should succeed");
    assert_eq!(first_count, 2);

    let second_count = manager
        .scan_midi_directory(dir.path())
        .expect("second midi scan should succeed and upsert duplicates");
    assert_eq!(second_count, 2);

    let rows = manager
        .list_midis_paginated(10, 0, None, None)
        .expect("list manager midi rows");
    assert_eq!(rows.len(), 2);

    let one_path = dir.path().join("one.mid");
    let one = manager
        .get_midi(one_path.to_str().expect("utf8 path"))
        .expect("get midi by path")
        .expect("midi should exist");
    assert_eq!(one.file_name, "one.mid");
}

#[test]
fn manager_scan_midi_directory_nonexistent_path_returns_zero() {
    let manager = SampleManager::new(None).expect("create manager");
    let count = manager
        .scan_midi_directory(Path::new("/tmp/__nonexistent_midi_scan_dir__"))
        .expect("scan should not fail for missing directory");
    assert_eq!(count, 0);
}
