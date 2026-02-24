//! Main entry point for the Open Sample Manager library.
//!
//! [`SampleManager`] composes the scanner, analysis, and database modules
//! into a single high-level API for discovering, analyzing, and querying
//! audio samples.
//!
//! # Quick Start
//!
//! ```rust,no_run
//! use open_sample_manager_core::SampleManager;
//!
//! let manager = SampleManager::new(None).expect("Failed to create manager");
//! let scanned = manager.scan_directory("/path/to/samples").expect("scan failed");
//! println!("Scanned {} files", scanned);
//!
//! let results = manager.search("kick").expect("search failed");
//! for sample in &results {
//!     println!("{} — BPM {:?}", sample.file_name, sample.bpm);
//! }
//! ```

use std::path::Path;

use rusqlite::Connection;

use crate::analysis::bpm::estimate_bpm;
use crate::analysis::decoder::{decode_to_mono_f32, DecodeError};
use crate::analysis::kick::detect_kick;
use crate::analysis::loop_classifier::{classify_loop, LoopType};
use crate::db::operations::{
    get_sample_by_path, insert_sample, search_samples, SampleInput, SampleRow,
};
use crate::db::schema::init_database;
use crate::scanner::scan_directory;
/// Progress information emitted during scanning.
#[derive(Debug, Clone)]
pub struct ScanProgress {
    /// Current stage of scanning.
    pub stage: ScanStage,
    /// Number of files processed so far.
    pub current: usize,
    /// Total number of files to process.
    pub total: usize,
    /// Currently processing file name.
    pub current_file: String,
}

/// Stages of the scanning process.
#[derive(Debug, Clone, PartialEq)]
pub enum ScanStage {
    /// Discovering files in the directory.
    Discovering,
    /// Analyzing and processing files.
    Analyzing,
    /// Scan completed.
    Complete,
}

impl std::fmt::Display for ScanStage {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ScanStage::Discovering => write!(f, "discovering"),
            ScanStage::Analyzing => write!(f, "analyzing"),
            ScanStage::Complete => write!(f, "complete"),
        }
    }
}

/// Errors that can occur within [`SampleManager`] operations.
#[derive(Debug)]
pub enum ManagerError {
    /// Database-related error.
    Db(rusqlite::Error),
    /// Audio decoding error.
    Decode(DecodeError),
    /// I/O or filesystem error.
    Io(std::io::Error),
}

impl std::fmt::Display for ManagerError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ManagerError::Db(e) => write!(f, "database error: {e}"),
            ManagerError::Decode(e) => write!(f, "decode error: {e}"),
            ManagerError::Io(e) => write!(f, "I/O error: {e}"),
        }
    }
}

impl std::error::Error for ManagerError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            ManagerError::Db(e) => Some(e),
            ManagerError::Decode(e) => Some(e),
            ManagerError::Io(e) => Some(e),
        }
    }
}

impl From<rusqlite::Error> for ManagerError {
    fn from(e: rusqlite::Error) -> Self {
        ManagerError::Db(e)
    }
}

impl From<DecodeError> for ManagerError {
    fn from(e: DecodeError) -> Self {
        ManagerError::Decode(e)
    }
}

impl From<std::io::Error> for ManagerError {
    fn from(e: std::io::Error) -> Self {
        ManagerError::Io(e)
    }
}

/// High-level manager that composes scanner, analysis, and database modules.
///
/// `SampleManager` is the primary entry point for:
/// - Scanning directories for audio files
/// - Analyzing audio samples (BPM, kick detection, loop classification)
/// - Persisting and retrieving sample metadata via `SQLite`
/// - Searching samples via FTS5 full-text search
///
/// # Examples
///
/// ```rust,no_run
/// use open_sample_manager_core::SampleManager;
///
/// // In-memory database (for testing or ephemeral use)
/// let manager = SampleManager::new(None).expect("create failed");
///
/// // File-backed database
/// let manager = SampleManager::new(Some("/data/samples.db")).expect("create failed");
/// ```
pub struct SampleManager {
    conn: Connection,
}

impl SampleManager {
    /// Create a new `SampleManager`.
    ///
    /// If `db_path` is `None`, an in-memory `SQLite` database is used.
    /// If `db_path` is `Some(path)`, a file-backed database is created or opened.
    ///
    /// The database schema is automatically initialized on creation.
    ///
    /// # Errors
    ///
    /// Returns [`ManagerError::Db`] if the database cannot be opened or the
    /// schema cannot be initialized.
    pub fn new(db_path: Option<&str>) -> Result<Self, ManagerError> {
        let conn = match db_path {
            Some(path) => Connection::open(path)?,
            None => Connection::open_in_memory()?,
        };
        init_database(&conn)?;
        Ok(SampleManager { conn })
    }

    /// Scan a directory for audio files, analyze each one, and store results.
    ///
    /// Recursively discovers audio files (WAV, MP3, FLAC, OGG, AIFF) in the
    /// given directory, decodes and analyzes each file for BPM, kick detection,
    /// and loop classification, then inserts the results into the database.
    ///
    /// Files that fail to decode are silently skipped. Files already in the
    /// database (duplicate path) are also skipped.
    ///
    /// # Returns
    ///
    /// The number of samples successfully analyzed and stored.
    ///
    /// # Errors
    ///
    /// Returns [`ManagerError::Io`] if the directory path is invalid.
    /// Scan a directory for audio files, analyze each one, and store results.
    /// This is a convenience method that calls `scan_directory_with_progress` with no progress callback.
    pub fn scan_directory(&self, path: impl AsRef<Path>) -> Result<usize, ManagerError> {
        self.scan_directory_with_progress(path, |_| {})
    }

    /// Scan a directory with progress reporting.
    ///
    /// The `progress` callback is invoked periodically during scanning with progress updates.
    pub fn scan_directory_with_progress(
        &self,
        path: impl AsRef<Path>,
        mut progress: impl FnMut(ScanProgress),
    ) -> Result<usize, ManagerError> {
        let dir = path.as_ref();
        
        // Stage 1: Discovering files
        progress(ScanProgress {
            stage: ScanStage::Discovering,
            current: 0,
            total: 0,
            current_file: "Scanning directory...".to_string(),
        });
        
        let files = scan_directory(dir);
        let total_files = files.len();
        
        // Emit discovery complete with total count
        progress(ScanProgress {
            stage: ScanStage::Discovering,
            current: 0,
            total: total_files,
            current_file: format!("Found {} audio files", total_files),
        });
        
        // Stage 2: Analyzing files
        let mut count = 0;
        
        for (idx, file_path) in files.into_iter().enumerate() {
            let file_name = file_path
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("unknown")
                .to_string();
            
            progress(ScanProgress {
                stage: ScanStage::Analyzing,
                current: idx + 1,
                total: total_files,
                current_file: file_name.clone(),
            });
            
            match self.analyze_and_store(&file_path) {
                Ok(_) => count += 1,
                Err(ManagerError::Db(rusqlite::Error::SqliteFailure(err, _)))
                    if err.code == rusqlite::ErrorCode::ConstraintViolation =>
                {
                    // Duplicate path — skip
                }
                Err(ManagerError::Decode(_)) => {
                    // Failed to decode — skip
                }
                Err(e) => return Err(e),
            }
        }

        // Complete
        progress(ScanProgress {
            stage: ScanStage::Complete,
            current: total_files,
            total: total_files,
            current_file: format!("Indexed {} samples", count),
        });

        Ok(count)
    }

    /// Analyze a single audio file and return its analysis results as a [`SampleInput`].
    ///
    /// Decodes the file, runs BPM estimation, kick detection, and loop
    /// classification, then returns the extracted metadata without storing
    /// it in the database.
    ///
    /// # Errors
    ///
    /// Returns [`ManagerError::Decode`] if the file cannot be decoded.
    pub fn analyze_file(&self, path: impl AsRef<Path>) -> Result<SampleInput, ManagerError> {
        let file_path = path.as_ref();
        let input = Self::analyze(file_path)?;
        Ok(input)
    }

    /// Search samples by file name using FTS5 full-text search.
    ///
    /// Supports FTS5 query syntax:
    /// - Simple terms: `"kick"`
    /// - Prefix matching: `"808*"`
    /// - Boolean: `"kick OR snare"`
    /// - Phrase: `"kick 808"` (both tokens must match)
    ///
    /// Results are ordered by FTS5 relevance (best match first).
    ///
    /// # Errors
    ///
    /// Returns [`ManagerError::Db`] on SQL or malformed query errors.
    pub fn search(&self, query: &str) -> Result<Vec<SampleRow>, ManagerError> {
        let results = search_samples(&self.conn, query)?;
        Ok(results)
    }

    /// Retrieve a sample by its absolute file path.
    ///
    /// Returns `None` if no sample with the given path exists in the database.
    ///
    /// # Errors
    ///
    /// Returns [`ManagerError::Db`] on SQL errors.
    pub fn get_sample(&self, path: &str) -> Result<Option<SampleRow>, ManagerError> {
        let row = get_sample_by_path(&self.conn, path)?;
        Ok(row)
    }

    /// Delete a sample by its file path.
    ///
    /// Also removes the corresponding FTS5 entry and tag associations.
    ///
    /// Returns the number of rows deleted (0 or 1).
    ///
    /// # Errors
    ///
    /// Returns [`ManagerError::Db`] on SQL errors.
    pub fn delete_sample(&self, path: &str) -> Result<usize, ManagerError> {
        let count = crate::db::operations::delete_sample(&self.conn, path)?;
        Ok(count)
    }

    /// Delete all samples from the database.
    ///
    /// Removes all rows from `samples`, `samples_fts`, and `sample_tags` tables.
    ///
    /// Returns the number of samples deleted.
    ///
    /// # Errors
    ///
    /// Returns [`ManagerError::Db`] on SQL errors.
    pub fn clear_all_samples(&self) -> Result<usize, ManagerError> {
        let count = crate::db::operations::clear_all_samples(&self.conn)?;
        Ok(count)
    }

    /// Move a sample file to a new location.
    ///
    /// Moves the physical file on disk and updates the database record.
    /// Returns the new path on success.
    ///
    /// # Errors
    ///
    /// Returns [`ManagerError::Io`] if the file cannot be moved.
    /// Returns [`ManagerError::Db`] if the database cannot be updated.
    pub fn move_sample(&self, old_path: &str, new_path: &str) -> Result<String, ManagerError> {
        use std::fs;

        // Move the physical file
        fs::rename(old_path, new_path)?;

        // Update database
        crate::db::operations::move_sample_path(&self.conn, old_path, new_path)?;

        Ok(new_path.to_string())
    }

    /// Analyze a file and store the result in the database.
    fn analyze_and_store(&self, file_path: &Path) -> Result<i64, ManagerError> {
        let input = Self::analyze(file_path)?;
        let id = insert_sample(&self.conn, &input)?;
        Ok(id)
    }

    /// Decode and analyze a single audio file, returning a [`SampleInput`].
    fn analyze(file_path: &Path) -> Result<SampleInput, ManagerError> {
        let decoded = decode_to_mono_f32(file_path)?;

        let bpm_result = estimate_bpm(&decoded.samples, decoded.sample_rate);
        let kick_result = detect_kick(&decoded.samples, decoded.sample_rate);

        #[allow(clippy::cast_precision_loss)]
        let duration = decoded.samples.len() as f64 / f64::from(decoded.sample_rate);
        let loop_type = classify_loop(duration, bpm_result.periodicity_strength);

        let sample_type = if kick_result.is_kick {
            "kick".to_string()
        } else {
            match loop_type {
                LoopType::Loop => "loop".to_string(),
                LoopType::OneShot => "oneshot".to_string(),
            }
        };

        let file_name = file_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string();

        let path_str = file_path.to_str().unwrap_or_default().to_string();
        let waveform_peaks = compute_waveform_peaks(&decoded.samples, 64);
        Ok(SampleInput {
            path: path_str,
            file_name,
            duration: Some(duration),
            bpm: Some(bpm_result.bpm),
            periodicity: Some(bpm_result.periodicity_strength),
            low_ratio: Some(kick_result.low_ratio),
            attack_slope: Some(kick_result.attack_slope),
            decay_time: Some(kick_result.decay_time_ms),
            sample_type: Some(sample_type),
            waveform_peaks: Some(waveform_peaks),
            embedding: None,
        })
    }
}

fn compute_waveform_peaks(samples: &[f32], num_peaks: usize) -> String {
    if samples.is_empty() || num_peaks == 0 {
        return "[]".to_string();
    }

    let samples_per_peak = (samples.len() + num_peaks - 1) / num_peaks;
    let mut peaks: Vec<f32> = Vec::with_capacity(num_peaks);

    for i in 0..num_peaks {
        let start = i * samples_per_peak;
        let end = (start + samples_per_peak).min(samples.len());
        if start >= samples.len() {
            break;
        }

        let chunk = &samples[start..end];
        let max_abs = chunk.iter()
            .map(|&s| s.abs())
            .fold(0.0f32, |a, b| a.max(b));
        peaks.push(max_abs);
    }

    let json: Vec<String> = peaks.iter().map(|p| format!("{:.6}", p)).collect();
    format!("[{}]", json.join(","))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::File;
    use std::io::Write;
    use tempfile::TempDir;

    /// Helper: create a SampleManager with in-memory DB.
    fn make_manager() -> SampleManager {
        SampleManager::new(None).expect("Failed to create in-memory manager")
    }

    /// Helper: build a minimal valid WAV file (mono, 11025 Hz, silence).
    fn build_silence_wav(duration_samples: usize) -> Vec<u8> {
        let sample_rate: u32 = 11_025;
        let num_channels: u16 = 1;
        let bits_per_sample: u16 = 16;
        let block_align = num_channels * bits_per_sample / 8;
        let byte_rate = sample_rate * u32::from(block_align);
        let data_size = (duration_samples * 2) as u32;
        let riff_size = 36 + data_size;

        let mut buf: Vec<u8> = Vec::with_capacity((riff_size + 8) as usize);
        buf.extend_from_slice(b"RIFF");
        buf.extend_from_slice(&riff_size.to_le_bytes());
        buf.extend_from_slice(b"WAVE");

        buf.extend_from_slice(b"fmt ");
        buf.extend_from_slice(&16u32.to_le_bytes());
        buf.extend_from_slice(&1u16.to_le_bytes()); // PCM
        buf.extend_from_slice(&num_channels.to_le_bytes());
        buf.extend_from_slice(&sample_rate.to_le_bytes());
        buf.extend_from_slice(&byte_rate.to_le_bytes());
        buf.extend_from_slice(&block_align.to_le_bytes());
        buf.extend_from_slice(&bits_per_sample.to_le_bytes());

        buf.extend_from_slice(b"data");
        buf.extend_from_slice(&data_size.to_le_bytes());
        for _ in 0..duration_samples {
            buf.extend_from_slice(&0i16.to_le_bytes());
        }

        buf
    }

    /// Helper: write a WAV file to a directory and return its path.
    fn write_wav(dir: &TempDir, name: &str, samples: usize) -> std::path::PathBuf {
        let path = dir.path().join(name);
        let wav_data = build_silence_wav(samples);
        let mut f = File::create(&path).expect("create wav file");
        f.write_all(&wav_data).expect("write wav data");
        path
    }

    #[test]
    fn new_creates_in_memory_manager() {
        let manager = SampleManager::new(None);
        assert!(manager.is_ok());
    }

    #[test]
    fn new_creates_file_backed_manager() {
        let dir = TempDir::new().unwrap();
        let db_path = dir.path().join("test.db");
        let manager = SampleManager::new(Some(db_path.to_str().unwrap()));
        assert!(manager.is_ok());
    }

    #[test]
    fn scan_directory_discovers_and_stores_samples() {
        let dir = TempDir::new().unwrap();
        // Create a few WAV files with enough samples to be analyzable
        write_wav(&dir, "kick.wav", 11_025);
        write_wav(&dir, "snare.wav", 11_025);

        // Also create a non-audio file that should be ignored
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
    fn search_prefix_matching() {
        let dir = TempDir::new().unwrap();
        write_wav(&dir, "kick_808.wav", 11_025);
        write_wav(&dir, "kick_909.wav", 11_025);
        write_wav(&dir, "snare.wav", 11_025);

        let manager = make_manager();
        manager.scan_directory(dir.path()).expect("scan failed");

        let results = manager.search("kick*").expect("search failed");
        assert_eq!(results.len(), 2);
    }
}
