use super::*;
use rusqlite::{params, Connection};
use std::fs::{self, File};
use tempfile::TempDir;

fn make_files(dir: &TempDir, names: &[&str]) {
    for name in names {
        File::create(dir.path().join(name)).expect("create file");
    }
}

#[test]
fn scan_finds_audio_files() {
    let dir = TempDir::new().unwrap();
    make_files(
        &dir,
        &[
            "kick.wav",
            "bass.mp3",
            "pad.flac",
            "lead.ogg",
            "crash.aiff",
            "readme.txt",
            "notes.pdf",
        ],
    );

    let mut found = scan_directory(dir.path());
    found.sort();

    let mut names: Vec<String> = found
        .iter()
        .map(|p| p.file_name().unwrap().to_string_lossy().into_owned())
        .collect();
    names.sort();

    assert_eq!(
        names,
        vec!["bass.mp3", "crash.aiff", "kick.wav", "lead.ogg", "pad.flac"]
    );
}

#[test]
fn scan_filters_non_audio_files() {
    let dir = TempDir::new().unwrap();
    make_files(&dir, &["image.png", "data.json", "script.sh"]);

    let found = scan_directory(dir.path());
    assert!(found.is_empty());
}

#[test]
fn scan_is_case_insensitive() {
    let dir = TempDir::new().unwrap();
    make_files(&dir, &["kick.WAV", "snare.MP3", "hi.Flac"]);

    let found = scan_directory(dir.path());
    assert_eq!(found.len(), 3);
}

#[test]
fn scan_nonexistent_directory_returns_empty() {
    let path = Path::new("/tmp/__this_path_definitely_does_not_exist_xyz__");
    let found = scan_directory(path);
    assert!(found.is_empty());
}

#[test]
fn scan_recurses_into_subdirectories() {
    let dir = TempDir::new().unwrap();
    let sub = dir.path().join("sub/deep");
    fs::create_dir_all(&sub).unwrap();
    File::create(sub.join("sample.wav")).unwrap();
    File::create(dir.path().join("top.flac")).unwrap();

    let found = scan_directory(dir.path());
    assert_eq!(found.len(), 2);
}

#[test]
fn get_file_mtime_returns_some_for_existing_file() {
    let dir = TempDir::new().unwrap();
    let file = dir.path().join("test.wav");
    File::create(&file).unwrap();

    let mtime = get_file_mtime(&file);

    assert!(mtime.is_some());
}

#[test]
fn get_file_mtime_returns_none_for_missing_file() {
    let path = Path::new("/tmp/__nonexistent_file_xyz__.wav");
    let mtime = get_file_mtime(path);
    assert!(mtime.is_none());
}

#[test]
fn incremental_scan_uses_mtime() {
    let dir = TempDir::new().unwrap();
    let file = dir.path().join("sample.wav");
    File::create(&file).unwrap();

    let mtime_before = get_file_mtime(&file).unwrap();

    std::thread::sleep(std::time::Duration::from_millis(10));
    fs::write(&file, b"data").unwrap();

    let mtime_after = get_file_mtime(&file).unwrap();
    assert!(mtime_after >= mtime_before);
}

#[test]
fn scanner_struct_scans_watched_paths() {
    let dir1 = TempDir::new().unwrap();
    let dir2 = TempDir::new().unwrap();
    File::create(dir1.path().join("a.wav")).unwrap();
    File::create(dir2.path().join("b.flac")).unwrap();

    let mut scanner = Scanner::new();
    scanner.add_path(dir1.path());
    scanner.add_path(dir2.path());

    let found = scanner.scan_all();
    assert_eq!(found.len(), 2);
}

fn setup_db() -> Connection {
    let conn = Connection::open_in_memory().expect("open in-memory DB");
    crate::db::schema::init_database(&conn).expect("init schema");
    ensure_incremental_columns(&conn).expect("ensure columns");
    conn
}

fn insert_sample_with_mtime(conn: &Connection, path: &str, file_name: &str, mtime: i64) {
    conn.execute(
        "INSERT INTO samples (path, file_name, last_modified) VALUES (?1, ?2, ?3)",
        params![path, file_name, mtime],
    )
    .expect("insert sample");
}

#[test]
fn incremental_scan_returns_all_files_on_empty_db() {
    let dir = TempDir::new().unwrap();
    make_files(&dir, &["kick.wav", "snare.mp3"]);
    let conn = setup_db();
    let scanner = Scanner::new();

    let changed = scanner.scan_incremental(&conn, dir.path()).unwrap();
    assert_eq!(changed.len(), 2);
}

#[test]
fn incremental_scan_skips_unchanged_files() {
    let dir = TempDir::new().unwrap();
    let file_path = dir.path().join("kick.wav");
    File::create(&file_path).unwrap();

    let conn = setup_db();
    let disk_mtime = get_file_mtime(&file_path)
        .map(time::system_time_to_unix)
        .unwrap();
    insert_sample_with_mtime(&conn, &file_path.to_string_lossy(), "kick.wav", disk_mtime);

    let scanner = Scanner::new();
    let changed = scanner.scan_incremental(&conn, dir.path()).unwrap();
    assert!(changed.is_empty(), "unchanged file should be skipped");
}

#[test]
fn incremental_scan_detects_modified_files() {
    let dir = TempDir::new().unwrap();
    let file_path = dir.path().join("kick.wav");
    File::create(&file_path).unwrap();

    let conn = setup_db();
    let old_mtime = 1_000_000i64;
    insert_sample_with_mtime(&conn, &file_path.to_string_lossy(), "kick.wav", old_mtime);

    let scanner = Scanner::new();
    let changed = scanner.scan_incremental(&conn, dir.path()).unwrap();
    assert_eq!(changed.len(), 1, "modified file should be detected");
}

#[test]
fn incremental_scan_updates_watched_paths_timestamp() {
    let dir = TempDir::new().unwrap();
    make_files(&dir, &["kick.wav"]);
    let conn = setup_db();
    let scanner = Scanner::new();

    assert!(get_last_scan_time(&conn, dir.path()).unwrap().is_none());

    scanner.scan_incremental(&conn, dir.path()).unwrap();

    let ts = get_last_scan_time(&conn, dir.path()).unwrap();
    assert!(ts.is_some(), "last_scanned_at should be set after scan");
}

#[test]
fn incremental_scan_mixed_new_and_unchanged() {
    let dir = TempDir::new().unwrap();
    let existing = dir.path().join("old.wav");
    let new_file = dir.path().join("new.flac");
    File::create(&existing).unwrap();
    File::create(&new_file).unwrap();

    let conn = setup_db();
    let disk_mtime = get_file_mtime(&existing)
        .map(time::system_time_to_unix)
        .unwrap();
    insert_sample_with_mtime(&conn, &existing.to_string_lossy(), "old.wav", disk_mtime);

    let scanner = Scanner::new();
    let changed = scanner.scan_incremental(&conn, dir.path()).unwrap();

    assert_eq!(changed.len(), 1, "only the new file should be returned");
    assert_eq!(
        changed[0].file_name().unwrap().to_string_lossy(),
        "new.flac"
    );
}

#[test]
fn ensure_incremental_columns_is_idempotent() {
    let conn = Connection::open_in_memory().expect("open in-memory DB");
    crate::db::schema::init_database(&conn).expect("init schema");

    ensure_incremental_columns(&conn).unwrap();
    ensure_incremental_columns(&conn).unwrap();
}
