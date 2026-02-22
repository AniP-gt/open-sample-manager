use std::f32::consts::PI;
use std::sync::Arc;

use realfft::{num_complex::Complex32, RealFftPlanner, RealToComplex};

pub const DEFAULT_FFT_SIZE: usize = 1024;
pub const DEFAULT_HOP_SIZE: usize = 512;

pub struct FftProcessor {
    fft_size: usize,
    fft: Arc<dyn RealToComplex<f32>>,
    scratch: Vec<Complex32>,
    input: Vec<f32>,
    spectrum: Vec<Complex32>,
}

impl FftProcessor {
    pub fn new() -> Self {
        Self::with_size(DEFAULT_FFT_SIZE)
    }

    pub fn with_size(fft_size: usize) -> Self {
        assert!(fft_size > 1, "FFT size must be greater than 1");

        let mut planner = RealFftPlanner::<f32>::new();
        let fft = planner.plan_fft_forward(fft_size);
        let scratch = vec![Complex32::default(); fft.get_scratch_len()];
        let input = vec![0.0; fft_size];
        let spectrum = fft.make_output_vec();

        Self {
            fft_size,
            fft,
            scratch,
            input,
            spectrum,
        }
    }

    pub fn output_len(&self) -> usize {
        self.spectrum.len()
    }

    pub fn process_frame(&mut self, frame: &[f32]) -> Vec<f32> {
        let mut magnitudes = vec![0.0; self.output_len()];
        self.process_frame_into_buffer(frame, &mut magnitudes);
        magnitudes
    }

    pub fn process_frame_into_buffer(&mut self, frame: &[f32], magnitudes: &mut [f32]) {
        assert_eq!(
            frame.len(),
            self.fft_size,
            "Input frame length does not match FFT size"
        );
        assert_eq!(
            magnitudes.len(),
            self.spectrum.len(),
            "Magnitude buffer length must match FFT output length"
        );

        self.input.copy_from_slice(frame);
        self.fft
            .process_with_scratch(&mut self.input, &mut self.spectrum, &mut self.scratch)
            .expect("Failed to process FFT frame");

        let scale = self.fft_size as f32;
        for (idx, bin) in self.spectrum.iter().enumerate() {
            magnitudes[idx] = bin.norm() / scale;
        }
    }
}

impl Default for FftProcessor {
    fn default() -> Self {
        Self::new()
    }
}

pub fn hann_window(size: usize) -> Vec<f32> {
    if size == 0 {
        return Vec::new();
    }

    if size == 1 {
        return vec![1.0];
    }

    let denominator = (size - 1) as f32;
    (0..size)
        .map(|n| {
            let phase = (2.0 * PI * n as f32) / denominator;
            0.5 * (1.0 - phase.cos())
        })
        .collect()
}

pub fn compute_stft(samples: &[f32], frame_size: usize, hop_size: usize) -> Vec<Vec<f32>> {
    if frame_size < 2 || hop_size == 0 || samples.len() < frame_size {
        return Vec::new();
    }

    let frame_count = if samples.len() == frame_size {
        1
    } else {
        (samples.len() - frame_size) / hop_size
    };

    if frame_count == 0 {
        return Vec::new();
    }

    let window = hann_window(frame_size);
    let mut frame = vec![0.0; frame_size];
    let mut processor = FftProcessor::with_size(frame_size);
    let mut magnitudes = vec![0.0; processor.output_len()];
    let mut spectra = Vec::with_capacity(frame_count);

    for frame_idx in 0..frame_count {
        let start = frame_idx * hop_size;
        let end = start + frame_size;

        if end > samples.len() {
            break;
        }

        for sample_idx in 0..frame_size {
            frame[sample_idx] = samples[start + sample_idx] * window[sample_idx];
        }

        processor.process_frame_into_buffer(&frame, &mut magnitudes);
        spectra.push(magnitudes.clone());
    }

    spectra
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hann_window_sum_is_close_to_half_of_frame_size() {
        let frame_size = 1024;
        let window = hann_window(frame_size);
        let sum: f32 = window.iter().sum();
        let expected = frame_size as f32 / 2.0;

        assert_eq!(window.len(), frame_size);
        assert!(window[0].abs() < 1e-6);
        assert!(window[frame_size - 1].abs() < 1e-6);
        assert!((sum - expected).abs() < 1.0);
    }

    #[test]
    fn fft_of_dc_signal_has_energy_at_bin_zero_only() {
        let mut processor = FftProcessor::new();
        let input = vec![1.0; DEFAULT_FFT_SIZE];
        let magnitudes = processor.process_frame(&input);

        assert!((magnitudes[0] - 1.0).abs() < 1e-5);
        for (idx, value) in magnitudes.iter().enumerate().skip(1) {
            assert!(
                value.abs() < 1e-5,
                "Expected near-zero magnitude at bin {idx}, got {value}"
            );
        }
    }

    #[test]
    fn stft_produces_expected_number_of_frames() {
        let samples = vec![0.0; 44_100];
        let stft = compute_stft(&samples, DEFAULT_FFT_SIZE, DEFAULT_HOP_SIZE);

        assert_eq!(stft.len(), 84);
        assert!(stft
            .iter()
            .all(|frame| frame.len() == (DEFAULT_FFT_SIZE / 2 + 1)));
    }
}
