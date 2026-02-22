/// Scanner module for filesystem sample discovery
use std::path::{Path, PathBuf};
use std::time::SystemTime;
use walkdir::WalkDir;

/// Audio file extensions supported by the scanner (lowercase).
const AUDIO_EXTENSIONS: &[&str] = &["wav", "mp3", "flac", "ogg", "aiff"];

/// Scanner that watches a set of root paths for audio files.
pub struct Scanner {
    /// Directory paths being monitored for audio files.
    pub watched_paths: Vec<PathBuf>,
}

impl Scanner {
    /// Create a new Scanner with no watched paths.
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

/// Recursively scan `path` for audio files.
///
/// Returns an empty `Vec` if the directory does not exist or cannot be read.
/// Permission errors on individual entries are silently skipped.
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
                .map(|e| e.to_lowercase());
            match ext {
                Some(e) if AUDIO_EXTENSIONS.contains(&e.as_str()) => Some(entry.into_path()),
                _ => None,
            }
        })
        .collect()
}

/// Return the last-modified time for `path`, or `None` on any error.
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
}
