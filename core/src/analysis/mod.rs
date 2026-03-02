/// MIDI file metadata extraction (tempo, duration, time signature, key, etc.).
pub mod midi;

/// Algorithms for BPM estimation from audio signals.
pub mod bpm;
/// Audio decoding support for various formats (WAV, MP3, FLAC, Ogg Vorbis).
pub mod decoder;
/// Analysis module for sample feature extraction and processing
pub mod fft_utils;
/// Kick drum detection algorithms and configuration.
pub mod kick;
/// Loop vs one-shot classification for audio samples.
pub mod loop_classifier;
/// Onset detection and spectral flux computation.
pub mod onset;

use std::path::PathBuf;

use self::bpm::BpmResult;
use self::kick::KickResult;
use self::loop_classifier::LoopType;

/// Analysis result containing extracted features and metadata for a single audio file.
#[derive(Debug, Clone)]
pub struct AnalysisResult {
    /// Absolute path to the analyzed audio file.
    pub path: PathBuf,
    /// BPM estimation result, if available.
    pub bpm: Option<BpmResult>,
    /// Kick detection result, if available.
    pub kick: Option<KickResult>,
    /// Classification as loop or one-shot.
    pub loop_type: LoopType,
    /// Duration of the audio file in seconds.
    pub duration_seconds: f32,
    /// Sample rate of the decoded audio (Hz).
    pub sample_rate: u32,
}
