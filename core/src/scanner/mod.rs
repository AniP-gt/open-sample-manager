/// Scanner module for filesystem sample discovery
use std::path::{Path, PathBuf};
use std::time::SystemTime;
use walkdir::WalkDir;

use rusqlite::{params, Connection};

/// Audio file extensions supported by the scanner (lowercase).
const AUDIO_EXTENSIONS: &[&str] = &["wav", "mp3", "flac", "ogg", "aiff"];

/// Scanner that watches a set of root paths for audio files.
pub struct Scanner {
    /// Directory paths being monitored for audio files.
    pub watched_paths: Vec<PathBuf>,
}

impl Scanner {
    /// Create a new Scanner with no watched paths.
    #[must_use]
    pub fn new() -> Self {
        Scanner {
            watched_paths: Vec::new(),
        }
    }

    /// Add a directory to the watched paths list.
    pub fn add_path(&mut self, path: impl Into<PathBuf>) {
        self.watched_paths.push(path.into());
    }

    /// Scan all watched paths and return discovered audio files.
    #[must_use]
    pub fn scan_all(&self) -> Vec<PathBuf> {
        let mut results = Vec::new();
        for path in &self.watched_paths {
            results.extend(scan_directory(path));
        }
        results
    }
}

impl Default for Scanner {
    fn default() -> Self {
        Self::new()
    }
}

/// Idempotent migration: adds `last_scanned_at` to `watched_paths` and `last_modified` to `samples`.
///
/// # Errors
/// Returns `rusqlite::Error` if any SQL statement fails.
pub fn ensure_incremental_columns(conn: &Connection) -> Result<(), rusqlite::Error> {
    let add_col = |sql: &str| -> Result<(), rusqlite::Error> {
        match conn.execute_batch(sql) {
            Ok(()) => Ok(()),
            Err(rusqlite::Error::SqliteFailure(err, _)) if err.extended_code == 1 => Ok(()),
            Err(e) => Err(e),
        }
    };
    add_col("ALTER TABLE watched_paths ADD COLUMN last_scanned_at INTEGER;")?;
    add_col("ALTER TABLE samples ADD COLUMN last_modified INTEGER;")?;
    Ok(())
}

/// Returns the `last_scanned_at` Unix timestamp for a directory, or `None` if untracked.
///
/// # Errors
/// Returns `rusqlite::Error` if any SQL statement fails.
pub fn get_last_scan_time(conn: &Connection, path: &Path) -> Result<Option<i64>, rusqlite::Error> {
    let path_str = path.to_string_lossy();
    let mut stmt =
        conn.prepare_cached("SELECT last_scanned_at FROM watched_paths WHERE path = ?1")?;
    match stmt.query_row(params![path_str.as_ref()], |row| {
        row.get::<_, Option<i64>>(0)
    }) {
        Ok(ts) => Ok(ts),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e),
    }
}

/// Returns `path→last_modified` mappings for all samples under `dir`.
///
/// # Errors
/// Returns `rusqlite::Error` if any SQL statement fails.
pub fn get_known_file_mtimes(
    conn: &Connection,
    dir: &Path,
) -> Result<std::collections::HashMap<String, Option<i64>>, rusqlite::Error> {
    let prefix = format!("{}%", dir.to_string_lossy());
    let mut stmt =
        conn.prepare_cached("SELECT path, last_modified FROM samples WHERE path LIKE ?1")?;
    let rows = stmt.query_map(params![prefix], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, Option<i64>>(1)?))
    })?;
    let mut map = std::collections::HashMap::new();
    for row in rows {
        let (path, mtime) = row?;
        map.insert(path, mtime);
    }
    Ok(map)
}

/// Update (or insert) the `last_scanned_at` timestamp for a watched directory.
///
/// # Errors
/// Returns `rusqlite::Error` if any SQL statement fails.
pub fn upsert_watched_path_scan_time(
    conn: &Connection,
    path: &Path,
    timestamp: i64,
) -> Result<(), rusqlite::Error> {
    let path_str = path.to_string_lossy();
    let updated = conn.execute(
        "UPDATE watched_paths SET last_scanned_at = ?1 WHERE path = ?2",
        params![timestamp, path_str.as_ref()],
    )?;
    if updated == 0 {
        conn.execute(
            "INSERT INTO watched_paths (path, last_scanned_at) VALUES (?1, ?2)",
            params![path_str.as_ref(), timestamp],
        )?;
    }
    Ok(())
}

fn system_time_to_unix(st: SystemTime) -> i64 {
    st.duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs().try_into().unwrap_or(0))
        .unwrap_or(0)
}

fn now_unix() -> i64 {
    system_time_to_unix(SystemTime::now())
}

impl Scanner {
    /// Scan `path` for audio files, returning only new or modified files compared to DB state.
    ///
    /// # Errors
    /// Returns `rusqlite::Error` if any SQL statement fails.
    pub fn scan_incremental(
        &self,
        conn: &Connection,
        path: &Path,
    ) -> Result<Vec<PathBuf>, rusqlite::Error> {
        ensure_incremental_columns(conn)?;

        let known = get_known_file_mtimes(conn, path)?;
        let all_files = scan_directory(path);

        let changed: Vec<PathBuf> = all_files
            .into_iter()
            .filter(|file_path| {
                let path_str = file_path.to_string_lossy().to_string();
                match known.get(&path_str) {
                    None => true,
                    Some(stored_mtime) => {
                        let disk_mtime = get_file_mtime(file_path).map(system_time_to_unix);
                        match (disk_mtime, stored_mtime) {
                            (Some(disk), Some(stored)) => disk > *stored,
                            (Some(_), None) => true,
                            _ => false,
                        }
                    }
                }
            })
            .collect();

        upsert_watched_path_scan_time(conn, path, now_unix())?;

        Ok(changed)
    }
}

/// Recursively scan `path` for audio files.
///
/// Returns an empty `Vec` if the directory does not exist or cannot be read.
/// Permission errors on individual entries are silently skipped.
#[must_use]
pub fn scan_directory(path: &Path) -> Vec<PathBuf> {
    if !path.exists() {
        return Vec::new();
    }

    WalkDir::new(path)
        .follow_links(false)
        .into_iter()
        .filter_map(|entry| {
            let entry = entry.ok()?;
            if !entry.file_type().is_file() {
                return None;
            }
            let ext = entry
                .path()
                .extension()
                .and_then(|e| e.to_str())
                .map(str::to_lowercase);
            match ext {
                Some(e) if AUDIO_EXTENSIONS.contains(&e.as_str()) => Some(entry.into_path()),
                _ => None,
            }
        })
        .collect()
}

/// Return the last-modified time for `path`, or `None` on any error.
#[must_use]
pub fn get_file_mtime(path: &Path) -> Option<SystemTime> {
    std::fs::metadata(path).ok().and_then(|m| m.modified().ok())
}

#[cfg(test)]
mod tests {
    use super::*;
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
        let disk_mtime = get_file_mtime(&file_path).map(system_time_to_unix).unwrap();
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
        let disk_mtime = get_file_mtime(&existing).map(system_time_to_unix).unwrap();
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
}
