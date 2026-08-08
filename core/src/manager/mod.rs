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
mod collections;
mod instrument_types;
mod midi;
mod midi_queries;
mod midi_tags;
mod migration;
mod migration_io;
mod processed_drag;
mod samples;
mod saved_searches;
mod scan;

use std::path::PathBuf;

use rusqlite::Connection;
use thiserror::Error;

use crate::analysis::decoder::DecodeError;
use crate::analysis::processed_wav::ProcessedWavError;
use crate::db::schema::init_database;

pub use migration::{LibraryExportSummary, LibraryImportSummary};
pub use processed_drag::ProcessedDragFile;

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
    ProcessedWav(ProcessedWavError),
}

impl std::fmt::Display for ManagerError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ManagerError::Db(e) => write!(f, "database error: {e}"),
            ManagerError::Decode(e) => write!(f, "decode error: {e}"),
            ManagerError::Io(e) => write!(f, "I/O error: {e}"),
            ManagerError::ProcessedWav(e) => write!(f, "processed WAV error: {e}"),
        }
    }
}

impl std::error::Error for ManagerError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            ManagerError::Db(e) => Some(e),
            ManagerError::Decode(e) => Some(e),
            ManagerError::Io(e) => Some(e),
            ManagerError::ProcessedWav(e) => Some(e),
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

impl From<ProcessedWavError> for ManagerError {
    fn from(e: ProcessedWavError) -> Self {
        ManagerError::ProcessedWav(e)
    }
}

/// Errors returned when similar-sample lookup fails.
#[derive(Debug, Error)]
pub enum SimilarityError {
    /// The requested sample id does not exist.
    #[error("sample id {0} was not found")]
    NotFound(i64),
    /// The source sample exists but has no embedding blob.
    #[error("sample id {0} is missing an embedding")]
    MissingEmbedding(i64),
    /// The source sample embedding blob is not a valid f32 array.
    #[error("sample id {0} has a malformed embedding blob")]
    MalformedEmbedding(i64),
    /// The requested number of similar samples is outside the supported range.
    #[error("similarity limit {0} must be within 1..=100")]
    InvalidLimit(usize),
    /// Database access failed.
    #[error("database error: {0}")]
    Db(#[from] rusqlite::Error),
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
    db_path: Option<PathBuf>,
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
        Ok(SampleManager {
            conn,
            db_path: db_path.map(PathBuf::from),
        })
    }
}

#[cfg(test)]
mod tests;
