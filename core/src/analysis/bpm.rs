use std::cmp::Ordering;

use rustfft::{num_complex::Complex32, FftPlanner};

use super::fft_utils::{compute_stft, DEFAULT_FFT_SIZE, DEFAULT_HOP_SIZE};
use super::onset::{compute_spectral_flux, normalize_flux};

const MIN_BPM: f64 = 60.0;
const MAX_BPM: f64 = 200.0;

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct BpmResult {
    pub bpm: f64,
    pub confidence: f64,
    pub periodicity_strength: f64,
}

impl BpmResult {
    fn empty() -> Self {
        Self {
            bpm: 0.0,
            confidence: 0.0,
            periodicity_strength: 0.0,
        }
    }
}

pub fn estimate_bpm(samples: &[f32], sample_rate: u32) -> BpmResult {
    if sample_rate == 0 || samples.len() < DEFAULT_FFT_SIZE {
        return BpmResult::empty();
    }

    let spectra = compute_stft(samples, DEFAULT_FFT_SIZE, DEFAULT_HOP_SIZE);
    if spectra.is_empty() {
        return BpmResult::empty();
    }

    let flux = compute_spectral_flux(&spectra);
    let normalized_flux = normalize_flux(&flux);
    if normalized_flux.is_empty() {
        return BpmResult::empty();
    }

    let autocorrelation = compute_autocorrelation_fft(&normalized_flux);
    if autocorrelation.is_empty() {
        return BpmResult::empty();
    }

    let frame_rate = sample_rate as f64 / DEFAULT_HOP_SIZE as f64;
    let lag_min = ((frame_rate * 60.0 / MAX_BPM).ceil() as usize).max(1);
    let lag_max = (frame_rate * 60.0 / MIN_BPM).floor() as usize;

    if lag_min > lag_max {
        return BpmResult::empty();
    }

    let search_end = lag_max.min(autocorrelation.len().saturating_sub(1));
    if lag_min > search_end {
        return BpmResult::empty();
    }

    let zero_lag = autocorrelation[0] as f64;
    if zero_lag <= f32::EPSILON as f64 {
        return BpmResult::empty();
    }

    let (best_lag, best_value) = (lag_min..=search_end)
        .map(|lag| (lag, autocorrelation[lag]))
        .max_by(|left, right| left.1.partial_cmp(&right.1).unwrap_or(Ordering::Equal))
        .unwrap_or((lag_min, 0.0));

    if best_lag == 0 {
        return BpmResult::empty();
    }

    let periodicity_strength = (best_value as f64 / zero_lag).max(0.0);
    let confidence = periodicity_strength.clamp(0.0, 1.0);
    let bpm = 60.0 * frame_rate / best_lag as f64;

    BpmResult {
        bpm,
        confidence,
        periodicity_strength,
    }
}

fn compute_autocorrelation_fft(envelope: &[f32]) -> Vec<f32> {
    if envelope.is_empty() {
        return Vec::new();
    }

    let fft_len = (envelope.len() * 2).next_power_of_two();
    let mut buffer = vec![Complex32::new(0.0, 0.0); fft_len];

    for (idx, value) in envelope.iter().enumerate() {
        buffer[idx].re = *value;
    }

    let mut planner = FftPlanner::<f32>::new();
    let forward_fft = planner.plan_fft_forward(fft_len);
    let inverse_fft = planner.plan_fft_inverse(fft_len);

    forward_fft.process(&mut buffer);

    for value in &mut buffer {
        *value *= value.conj();
    }

    inverse_fft.process(&mut buffer);

    buffer
        .into_iter()
        .take(envelope.len())
        .map(|v| v.re)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn estimates_bpm_for_constant_tempo_within_five_percent() {
        let sample_rate = 11_025u32;
        let target_bpm = 90.0;
        let samples = generate_click_track(sample_rate, target_bpm, 20.0);

        let result = estimate_bpm(&samples, sample_rate);
        let relative_error = ((result.bpm - target_bpm) / target_bpm).abs();

        assert!(relative_error <= 0.05, "estimated bpm: {}", result.bpm);
        assert!(result.confidence > 0.1, "confidence: {}", result.confidence);
    }

    #[test]
    fn non_periodic_signal_has_near_zero_confidence() {
        let sample_rate = 11_025u32;
        let samples = vec![0.0; sample_rate as usize * 6];

        let result = estimate_bpm(&samples, sample_rate);

        assert_eq!(result.bpm, 0.0);
        assert!(
            result.confidence <= 1e-6,
            "confidence: {}",
            result.confidence
        );
        assert!(
            result.periodicity_strength <= 1e-6,
            "periodicity strength: {}",
            result.periodicity_strength
        );
    }

    #[test]
    fn generated_120_bpm_signal_is_estimated_in_expected_range() {
        let sample_rate = 11_025u32;
        let samples = generate_click_track(sample_rate, 120.0, 20.0);

        let result = estimate_bpm(&samples, sample_rate);

        assert!(
            (115.0..=125.0).contains(&result.bpm),
            "estimated bpm: {}",
            result.bpm
        );
        assert!(result.periodicity_strength > 0.1);
    }

    #[test]
    fn short_signal_returns_empty_result() {
        let sample_rate = 11_025u32;
        let samples = vec![0.0; DEFAULT_FFT_SIZE - 1];

        let result = estimate_bpm(&samples, sample_rate);

        assert_eq!(result, BpmResult::empty());
    }

    fn generate_click_track(sample_rate: u32, bpm: f64, duration_seconds: f64) -> Vec<f32> {
        let total_samples = (sample_rate as f64 * duration_seconds) as usize;
        let interval_samples = ((sample_rate as f64 * 60.0 / bpm).round() as usize).max(1);
        let mut samples = vec![0.0; total_samples];
        let mut position = DEFAULT_HOP_SIZE;

        while position < total_samples {
            for (offset, amplitude) in [1.0, 0.7, 0.45, 0.2].iter().enumerate() {
                if let Some(sample) = samples.get_mut(position + offset) {
                    *sample = *amplitude;
                }
            }

            position += interval_samples;
        }

        samples
    }
}
