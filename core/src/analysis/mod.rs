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

/// Analysis result containing extracted features and metadata.
#[derive(Debug, Clone)]
pub struct AnalysisResult {
    /// Numerical feature vector extracted from audio analysis.
    pub features: Vec<f64>,
    /// Metadata string associated with the analysis result.
    pub metadata: String,
}
