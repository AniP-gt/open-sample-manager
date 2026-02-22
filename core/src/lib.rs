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
//!
//! // Scan a directory for audio samples
//! let mut scanner = Scanner::new();
//! scanner.add_path("/path/to/samples".into());
//! let samples = scanner.scan_all();
//!
//! // Analyze samples in parallel
//! let pool = AnalysisPool::new(4, "samples.db").expect("Failed to create pool");
//! for sample in samples {
//!     pool.submit_analysis(&sample.file_name);
//! }
//! pool.shutdown().expect("Failed to shutdown pool");
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
//! - [`SMHandle`] — FFI opaque handle type
//!
//! ## Module Structure
//!
//! - [`analysis`] — Audio analysis algorithms (BPM, kick detection, loop classification)
//! - [`db`] — Database schema and initialization
//! - [`scanner`] — Directory scanning and file discovery
//! - [`threading`] — Parallel processing with thread pools
//! - [`ffi`] — C-compatible interface for external integration
//! - [`search`] — Sample search and query functionality
//! - [`embedding`] — Audio feature embedding generation
//!

#![warn(missing_docs)]
#![doc(html_root_url = "https://docs.rs/open-sample-manager-core/0.1.0")]

use serde::{Deserialize, Serialize};

pub mod analysis;
pub mod db;
pub mod scanner;
pub mod threading;
pub mod ffi;
pub mod search;
pub mod embedding;

// Re-exports of commonly-used types for ergonomic API
pub use analysis::bpm::BpmResult;
pub use analysis::kick::KickResult;
pub use analysis::loop_classifier::LoopType;
pub use analysis::decoder::DecodedAudio;
pub use db::schema::init_database;
pub use scanner::Scanner;
pub use threading::AnalysisPool;
pub use ffi::handle::SMHandle;

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