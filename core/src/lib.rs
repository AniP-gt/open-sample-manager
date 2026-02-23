//! # Open Sample Manager Core
//!
//! Audio analysis and sample management library for music production.
//!
//! ## Features
//!
//! - **BPM Estimation** — Detect tempo from audio using onset detection and autocorrelation
//! - **Kick Detection** — Identify kick drum presence and characteristics
//! - **Loop Classification** — Classify audio samples as loops or one-shots
//! - **Audio Decoding** — Support for WAV, MP3, FLAC, and Ogg Vorbis formats
//! - **Sample Scanning** — Recursive directory scanning with metadata extraction
//! - **Database Storage** — SQLite-backed sample storage and retrieval
//! - **Parallel Analysis** — Thread pool for concurrent sample processing
//! - **FFI Support** — C-compatible interface for JUCE plugin integration
//!
//! ## Quick Start
//!
//! ```rust,no_run
//! use open_sample_manager_core::{Scanner, AnalysisPool};
//! use std::path::{Path, PathBuf};
//!
//! // Scan a directory for audio samples
//! let mut scanner = Scanner::new();
//! scanner.add_path("/path/to/samples");
//! let samples = scanner.scan_all();
//!
//! // Analyze samples in parallel
//! let db_path = Path::new("/path/to/samples.db");
//! let pool = AnalysisPool::new(4, db_path).expect("Failed to create pool");
//! for sample_path in samples {
//!     let _ = pool.queue(sample_path, || {
//!         unimplemented!("analysis implementation")
//!     });
//! }
//! pool.shutdown();
//! ```
//!
//! ## Re-exports
//!
//! This crate re-exports commonly-used types at the root level for convenience:
//!
//! - [`BpmResult`] — BPM estimation output
//! - [`KickResult`] — Kick detection output
//! - [`LoopType`] — Loop classification enum
//! - [`DecodedAudio`] — Decoded audio samples
//! - [`Scanner`] — Directory scanner for audio files
//! - [`AnalysisPool`] — Parallel analysis thread pool
//! - [`SampleManager`] — High-level entry point composing scanner, analysis, and DB
//! - [`SMHandle`] — FFI opaque handle type
//!
//! ## Module Structure
//!
//! - [`analysis`] — Audio analysis algorithms (BPM, kick detection, loop classification)
//! - [`db`] — Database schema and initialization
//! - [`manager`] — High-level sample management API
//! - [`scanner`] — Directory scanning and file discovery
//! - [`threading`] — Parallel processing with thread pools
//! - [`ffi`] — C-compatible interface for external integration
//! - [`search`] — Sample search and query functionality
//! - [`embedding`] — Audio feature embedding generation
//!

#![warn(missing_docs)]
#![doc(html_root_url = "https://docs.rs/open-sample-manager-core/0.1.0")]

use serde::{Deserialize, Serialize};

/// Audio analysis algorithms (BPM, kick detection, loop classification).
pub mod analysis;
/// Database schema and initialization.
pub mod db;
/// Audio feature embedding generation.
pub mod embedding;
/// C-compatible interface for external integration.
pub mod ffi;
/// High-level sample management entry point.
pub mod manager;
/// Directory scanning and file discovery.
pub mod scanner;
/// Sample search and query functionality.
pub mod search;
/// Parallel processing with thread pools.
pub mod threading;

// Re-exports of commonly-used types for ergonomic API
pub use analysis::bpm::BpmResult;
pub use analysis::decoder::DecodedAudio;
pub use analysis::kick::KickResult;
pub use analysis::loop_classifier::LoopType;
pub use db::schema::init_database;
pub use ffi::handle::SMHandle;
pub use manager::{ManagerError, SampleManager, ScanProgress, ScanStage};
pub use scanner::Scanner;
pub use threading::AnalysisPool;

/// Metadata summary for a sample file.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SampleSummary {
    /// Original filename (without directory path)
    pub file_name: String,
    /// Duration in seconds
    pub duration_seconds: f32,
}

/// Health check function to verify the core library is operational.
///
/// Returns a status string indicating the library is ready for use.
///
/// # Examples
///
/// ```
/// use open_sample_manager_core::healthcheck;
///
/// let status = healthcheck();
/// assert!(!status.is_empty());
/// ```
#[must_use]
pub fn healthcheck() -> &'static str {
    "open-sample-manager-core-ready"
}

#[cfg(test)]
mod tests {
    use super::healthcheck;

    #[test]
    fn healthcheck_returns_expected_value() {
        assert_eq!(healthcheck(), "open-sample-manager-core-ready");
    }
}
