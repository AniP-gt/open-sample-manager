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

mod analyze;
mod audio;
mod midi;
mod scan;

use std::path::Path;

use rusqlite::Connection;

use crate::analysis::decoder::DecodeError;
use crate::db::operations::{
    get_sample_by_path, search_samples, EmbeddingSearchResult, InstrumentTypeRow, MidiRow,
    MidiTagRow, SampleInput, SampleRow,
};
use crate::db::schema::init_database;

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
    fn from(e: rusqlite::Error) -> Self { ManagerError::Db(e) }
}

impl From<DecodeError> for ManagerError {
    fn from(e: DecodeError) -> Self { ManagerError::Decode(e) }
}

impl From<std::io::Error> for ManagerError {
    fn from(e: std::io::Error) -> Self { ManagerError::Io(e) }
}

/// High-level manager that composes scanner, analysis, and database modules.
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

// ── Core lifecycle ────────────────────────────────────────────────────────────

impl SampleManager {
    /// Create a new `SampleManager`.
    ///
    /// If `db_path` is `None`, an in-memory `SQLite` database is used.
    pub fn new(db_path: Option<&str>) -> Result<Self, ManagerError> {
        let conn = match db_path {
            Some(path) => Connection::open(path)?,
            None => Connection::open_in_memory()?,
        };
        init_database(&conn)?;
        Ok(SampleManager { conn })
    }
}

// ── Audio sample scanning & analysis ─────────────────────────────────────────

impl SampleManager {
    /// Scan a directory, analyze each audio file, and store results.
    pub fn scan_directory(&self, path: impl AsRef<Path>) -> Result<usize, ManagerError> {
        self.scan_directory_with_progress(path, |_| {})
    }

    /// Scan a directory with progress reporting.
    pub fn scan_directory_with_progress(
        &self,
        path: impl AsRef<Path>,
        progress: impl FnMut(ScanProgress),
    ) -> Result<usize, ManagerError> {
        scan::scan_with_progress(&self.conn, path.as_ref(), progress)
    }

    /// Analyze a single audio file without storing it.
    pub fn analyze_file(&self, path: impl AsRef<Path>) -> Result<SampleInput, ManagerError> {
        analyze::analyze(path.as_ref())
    }

    /// Analyze and store a single audio file. Returns the inserted row id.
    pub fn import_file(&self, path: impl AsRef<Path>) -> Result<i64, ManagerError> {
        analyze::analyze_and_store(&self.conn, path.as_ref())
    }
}

// ── Sample queries & CRUD ─────────────────────────────────────────────────────

impl SampleManager {
    pub fn search(&self, query: &str) -> Result<Vec<SampleRow>, ManagerError> {
        Ok(search_samples(&self.conn, query)?)
    }

    pub fn list_samples_paginated(&self, limit: usize, offset: usize) -> Result<Vec<SampleRow>, ManagerError> {
        Ok(crate::db::operations::list_samples_paginated(&self.conn, limit, offset)?)
    }

    pub fn search_paginated(&self, query: &str, limit: usize, offset: usize) -> Result<Vec<SampleRow>, ManagerError> {
        Ok(crate::db::operations::search_samples_paginated(&self.conn, query, limit, offset)?)
    }

    pub fn get_sample(&self, path: &str) -> Result<Option<SampleRow>, ManagerError> {
        Ok(get_sample_by_path(&self.conn, path)?)
    }

    pub fn get_all_sample_paths(&self) -> Result<Vec<String>, ManagerError> {
        Ok(crate::db::operations::get_all_sample_paths(&self.conn)?)
    }

    pub fn delete_sample(&self, path: &str) -> Result<usize, ManagerError> {
        Ok(crate::db::operations::delete_sample(&self.conn, path)?)
    }

    pub fn clear_all_samples(&self) -> Result<usize, ManagerError> {
        Ok(crate::db::operations::clear_all_samples(&self.conn)?)
    }

    pub fn move_sample(&self, old_path: &str, new_path: &str) -> Result<String, ManagerError> {
        std::fs::rename(old_path, new_path)?;
        crate::db::operations::move_sample_path(&self.conn, old_path, new_path)?;
        Ok(new_path.to_string())
    }

    pub fn search_by_embedding(&self, query: &[f32], k: usize) -> Result<Vec<EmbeddingSearchResult>, ManagerError> {
        crate::db::operations::search_by_embedding(&self.conn, query, k).map_err(ManagerError::Db)
    }

    pub fn update_sample_classification(
        &self,
        sample_id: Option<i64>,
        path: Option<&str>,
        playback_type: Option<String>,
        instrument_type: Option<String>,
    ) -> Result<usize, ManagerError> {
        let existing = match sample_id {
            Some(id) => crate::db::operations::get_sample_by_id(&self.conn, id)?,
            None => match path {
                Some(p) => crate::db::operations::get_sample_by_path(&self.conn, p)?,
                None => None,
            },
        };

        let Some(row) = existing else { return Ok(0) };

        let pt = playback_type.unwrap_or_else(|| row.playback_type.clone());
        let it = instrument_type.unwrap_or_else(|| row.instrument_type.clone());
        let sample_type = if pt == "loop" { "loop" } else { "oneshot" }.to_string();

        let input = SampleInput {
            path: row.path,
            file_name: row.file_name,
            duration: row.duration,
            bpm: row.bpm,
            periodicity: row.periodicity,
            sample_rate: row.sample_rate,
            file_size: row.file_size,
            artist: row.artist,
            low_ratio: row.low_ratio,
            attack_slope: row.attack_slope,
            decay_time: row.decay_time,
            sample_type: Some(sample_type),
            waveform_peaks: row.waveform_peaks,
            embedding: row.embedding,
            playback_type: Some(pt),
            instrument_type: Some(it),
        };
        Ok(crate::db::operations::update_sample(&self.conn, &input)?)
    }
}

// ── Instrument type management ────────────────────────────────────────────────

impl SampleManager {
    pub fn get_all_instrument_types(&self) -> Result<Vec<InstrumentTypeRow>, ManagerError> {
        Ok(crate::db::operations::get_all_instrument_types(&self.conn)?)
    }

    pub fn add_instrument_type(&self, name: &str) -> Result<i64, ManagerError> {
        Ok(crate::db::operations::insert_instrument_type(&self.conn, name)?)
    }

    pub fn delete_instrument_type(&self, id: i64) -> Result<usize, ManagerError> {
        Ok(crate::db::operations::delete_instrument_type(&self.conn, id)?)
    }

    pub fn update_instrument_type(&self, id: i64, name: &str) -> Result<usize, ManagerError> {
        Ok(crate::db::operations::update_instrument_type(&self.conn, id, name)?)
    }
}

// ── MIDI scanning & queries ───────────────────────────────────────────────────

impl SampleManager {
    pub fn scan_midi_directory(&self, path: impl AsRef<Path>) -> Result<usize, ManagerError> {
        midi::scan_midi_directory(&self.conn, path.as_ref())
    }

    pub fn list_midis_paginated(&self, limit: usize, offset: usize) -> Result<Vec<MidiRow>, ManagerError> {
        midi::list_midis_paginated(&self.conn, limit, offset)
    }

    pub fn get_all_midi_paths(&self) -> Result<Vec<String>, ManagerError> {
        midi::get_all_midi_paths(&self.conn)
    }

    pub fn get_midi(&self, path: &str) -> Result<Option<MidiRow>, ManagerError> {
        midi::get_midi(&self.conn, path)
    }

    pub fn delete_midi(&self, path: &str) -> Result<usize, ManagerError> {
        midi::delete_midi(&self.conn, path)
    }

    pub fn clear_all_midis(&self) -> Result<usize, ManagerError> {
        midi::clear_all_midis(&self.conn)
    }

    pub fn search_midis(&self, query: &str) -> Result<Vec<MidiRow>, ManagerError> {
        midi::search_midis(&self.conn, query)
    }
}

// ── MIDI tag management ───────────────────────────────────────────────────────

impl SampleManager {
    pub fn get_all_midi_tags(&self) -> Result<Vec<MidiTagRow>, ManagerError> {
        midi::get_all_midi_tags(&self.conn)
    }

    pub fn add_midi_tag(&self, name: &str) -> Result<i64, ManagerError> {
        midi::add_midi_tag(&self.conn, name)
    }

    pub fn delete_midi_tag(&self, id: i64) -> Result<usize, ManagerError> {
        midi::delete_midi_tag(&self.conn, id)
    }

    pub fn update_midi_tag(&self, id: i64, name: &str) -> Result<usize, ManagerError> {
        midi::update_midi_tag(&self.conn, id, name)
    }

    pub fn set_midi_file_tag(&self, midi_id: i64, tag_id: Option<i64>) -> Result<(), ManagerError> {
        midi::set_midi_file_tag(&self.conn, midi_id, tag_id)
    }

    pub fn get_midi_file_tags(&self, midi_id: i64) -> Result<Vec<MidiTagRow>, ManagerError> {
        midi::get_midi_file_tags(&self.conn, midi_id)
    }
}

#[cfg(test)]
mod tests;
