use std::path::{Path, PathBuf};
use std::time::SystemTime;

use walkdir::WalkDir;

const AUDIO_EXTENSIONS: &[&str] = &["wav", "mp3", "flac", "ogg", "aiff"];
const MIDI_EXTENSIONS: &[&str] = &["mid", "midi"];

/// Recursively scan `path` for audio files.
#[must_use]
pub fn scan_directory(path: &Path) -> Vec<PathBuf> {
    scan_with_extensions(path, AUDIO_EXTENSIONS)
}

/// Recursively scan `path` for MIDI files.
#[must_use]
pub fn scan_midi_directory(path: &Path) -> Vec<PathBuf> {
    scan_with_extensions(path, MIDI_EXTENSIONS)
}

/// Return the last-modified time for `path`, or `None` on any error.
#[must_use]
pub fn get_file_mtime(path: &Path) -> Option<SystemTime> {
    std::fs::metadata(path).ok().and_then(|m| m.modified().ok())
}

fn scan_with_extensions(path: &Path, extensions: &[&str]) -> Vec<PathBuf> {
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
                Some(e) if extensions.contains(&e.as_str()) => Some(entry.into_path()),
                _ => None,
            }
        })
        .collect()
}
