//! Scanner module for filesystem sample discovery.

mod db;
mod discovery;
mod time;

#[cfg(test)]
mod tests;

use std::path::{Path, PathBuf};

use rusqlite::Connection;

pub use db::{
    ensure_incremental_columns, get_known_file_mtimes, get_last_scan_time,
    upsert_watched_path_scan_time,
};
pub use discovery::{get_file_mtime, scan_directory, scan_midi_directory};

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
        db::ensure_incremental_columns(conn)?;

        let known = db::get_known_file_mtimes(conn, path)?;
        let all_files = discovery::scan_directory(path);

        let changed: Vec<PathBuf> = all_files
            .into_iter()
            .filter(|file_path| {
                let path_str = file_path.to_string_lossy().to_string();
                match known.get(&path_str) {
                    None => true,
                    Some(stored_mtime) => {
                        let disk_mtime =
                            discovery::get_file_mtime(file_path).map(time::system_time_to_unix);
                        match (disk_mtime, stored_mtime) {
                            (Some(disk), Some(stored)) => disk > *stored,
                            (Some(_), None) => true,
                            _ => false,
                        }
                    }
                }
            })
            .collect();

        db::upsert_watched_path_scan_time(conn, path, time::now_unix())?;

        Ok(changed)
    }
}
