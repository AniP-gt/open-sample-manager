pub mod bpm;
pub mod decoder;
/// Analysis module for sample feature extraction and processing
pub mod fft_utils;
pub mod kick;
pub mod loop_classifier;
pub mod onset;

pub struct AnalysisResult {
    pub features: Vec<f64>,
    pub metadata: String,
}
