use super::{extract_approved_archive, ArchiveError};
use std::{fs::File, io::Write};

fn archive(entries: &[(&str, &[u8])]) -> tempfile::NamedTempFile {
    let file = tempfile::NamedTempFile::new().expect("temp archive");
    let mut writer = zip::ZipWriter::new(File::create(file.path()).expect("archive file"));
    for (name, data) in entries {
        writer
            .start_file(*name, zip::write::SimpleFileOptions::default())
            .expect("entry");
        writer.write_all(data).expect("entry body");
    }
    writer.finish().expect("finish archive");
    file
}

mod limits;

#[test]
fn rejects_traversal_and_cleans_staging() {
    let input = archive(&[("../escape.wav", b"RIFFxxxxWAVE")]);
    let parent = tempfile::tempdir().expect("dir");
    let staging = parent.path().join("out");
    assert!(matches!(
        extract_approved_archive(input.path(), &staging),
        Err(ArchiveError::Unsafe("path traversal or depth"))
    ));
    assert!(!staging.exists());
}

#[test]
fn rejects_scripts_nested_archives_and_collisions() {
    for entries in [
        vec![("run.sh", b"#!/bin/sh" as &[u8])],
        vec![("inner.zip", b"PK")],
        vec![("A.wav", b"RIFFxxxxWAVE"), ("a.wav", b"RIFFxxxxWAVE")],
    ] {
        let input = archive(&entries);
        let parent = tempfile::tempdir().expect("dir");
        assert!(matches!(
            extract_approved_archive(input.path(), &parent.path().join("out")),
            Err(ArchiveError::Unsafe(_))
        ));
    }
}

#[test]
fn rejects_malformed_and_signature_mismatch_before_writes() {
    let malformed = tempfile::NamedTempFile::new().expect("temp");
    std::fs::write(malformed.path(), b"not a zip").expect("write");
    assert!(matches!(
        extract_approved_archive(
            malformed.path(),
            &tempfile::tempdir().expect("dir").path().join("out")
        ),
        Err(ArchiveError::Zip(_))
    ));
    let input = archive(&[("kit/fake.wav", b"not audio")]);
    let parent = tempfile::tempdir().expect("dir");
    let staging = parent.path().join("out");
    assert!(matches!(
        extract_approved_archive(input.path(), &staging),
        Err(ArchiveError::Unsafe("file signature mismatch"))
    ));
    assert!(!staging.exists());
}

#[test]
fn accepts_valid_audio_and_midi() {
    let input = archive(&[
        ("kit/kick.wav", b"RIFFxxxxWAVE"),
        ("kit/pattern.mid", b"MThd\0\0\0\x06"),
    ]);
    let parent = tempfile::tempdir().expect("dir");
    let staging = parent.path().join("out");
    extract_approved_archive(input.path(), &staging).expect("approved archive");
    assert!(staging.join("kick.wav").is_file());
    assert!(staging.join("pattern.mid").is_file());
}

#[test]
fn extracts_nested_approved_entries_as_root_level_basenames() {
    let input = archive(&[
        ("kit/drums/kick.wav", b"RIFFxxxxWAVE"),
        ("kit/midi/pattern.mid", b"MThd\0\0\0\x06"),
    ]);
    let parent = tempfile::tempdir().expect("dir");
    let staging = parent.path().join("out");
    extract_approved_archive(input.path(), &staging).expect("approved archive");
    assert!(staging.join("kick.wav").is_file());
    assert!(staging.join("pattern.mid").is_file());
}

#[test]
fn rejects_duplicate_root_basenames_without_leaving_partial_staging() {
    let input = archive(&[
        ("kit-a/kick.wav", b"RIFFxxxxWAVE"),
        ("kit-b/kick.wav", b"RIFFxxxxWAVE"),
    ]);
    let parent = tempfile::tempdir().expect("dir");
    let staging = parent.path().join("out");
    let result = extract_approved_archive(input.path(), &staging);
    assert!(matches!(result, Err(ArchiveError::Unsafe(_))));
    assert!(!staging.exists());
}

#[test]
fn cleans_failed_provider_staging_directories() {
    let input = archive(&[("../escape.wav", b"RIFFxxxxWAVE")]);
    let parent = tempfile::tempdir().expect("dir");
    let staging = parent.path().join(".provider-failed-import");
    let result = extract_approved_archive(input.path(), &staging);
    assert!(matches!(result, Err(ArchiveError::Unsafe(_))));
    assert!(!staging.exists());
}
