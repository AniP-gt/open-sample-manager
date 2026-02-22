/// Analysis module for sample feature extraction and processing
pub mod fft_utils;

pub struct AnalysisResult {
    pub features: Vec<f64>,
    pub metadata: String,
}
