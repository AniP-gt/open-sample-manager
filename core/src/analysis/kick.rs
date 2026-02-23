use std::cmp::Ordering;

use super::fft_utils::{compute_stft, DEFAULT_FFT_SIZE, DEFAULT_HOP_SIZE};

#[derive(Debug, Clone, Copy, PartialEq)]
/// Configuration parameters for kick drum detection algorithm.
pub struct KickDetectionConfig {
    /// Lower frequency boundary (Hz) for the low frequency band.
    pub low_band_start_hz: f64,
    /// Upper frequency boundary (Hz) for the low frequency band.
    pub low_band_end_hz: f64,
    /// Threshold for low band energy ratio to trigger kick detection.
    pub low_ratio_threshold: f64,
    /// Minimum slope (dB/ms) of attack to qualify as a kick.
    pub attack_slope_threshold: f64,
    /// Ratio of decay level relative to peak (0.0 to 1.0).
    pub decay_level_ratio: f64,
    /// Maximum allowed decay time in milliseconds.
    pub max_decay_time_ms: f64,
    /// Window size (ms) for envelope analysis.
    pub envelope_window_ms: f64,
    /// FFT size for spectral analysis.
    pub fft_size: usize,
    /// Hop size (stride) for spectral frames.
    pub hop_size: usize,
}

impl Default for KickDetectionConfig {
    fn default() -> Self {
        Self {
            low_band_start_hz: 20.0,
            low_band_end_hz: 150.0,
            low_ratio_threshold: 0.6,
            attack_slope_threshold: 25.0,
            decay_level_ratio: 0.2,
            max_decay_time_ms: 400.0,
            envelope_window_ms: 5.0,
            fft_size: DEFAULT_FFT_SIZE,
            hop_size: DEFAULT_HOP_SIZE,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq)]
/// Result of kick drum detection containing detection status and analysis metrics.
pub struct KickResult {
    /// True if a kick drum was detected.
    pub is_kick: bool,
    /// Energy ratio of low frequency band relative to full spectrum.
    pub low_ratio: f64,
    /// Attack slope in dB/ms (steepness of amplitude increase).
    pub attack_slope: f64,
    /// Duration in milliseconds of the decay phase.
    pub decay_time_ms: f64,
}

impl KickResult {
    fn empty() -> Self {
        Self {
            is_kick: false,
            low_ratio: 0.0,
            attack_slope: 0.0,
            decay_time_ms: f64::INFINITY,
        }
    }
}

/// Detect kick drums in audio samples using default configuration.
///
/// Uses standard thresholds optimized for typical music production samples.
#[must_use]
pub fn detect_kick(samples: &[f32], sample_rate: u32) -> KickResult {
    detect_kick_with_config(samples, sample_rate, KickDetectionConfig::default())
}

/// Detect kick drums with custom configuration parameters.
///
/// # Arguments
/// * `samples` - Audio samples to analyze
/// * `sample_rate` - Sample rate in Hz
/// * `config` - Detection configuration with thresholds and parameters
///
/// # Returns
/// `KickResult` with detection status and analysis metrics.
#[must_use]
pub fn detect_kick_with_config(
    samples: &[f32],
    sample_rate: u32,
    config: KickDetectionConfig,
) -> KickResult {
    if sample_rate == 0 || samples.is_empty() {
        return KickResult::empty();
    }

    let low_ratio = compute_low_band_energy_ratio(samples, sample_rate, config);
    let (envelope, frame_duration_seconds) =
        compute_abs_envelope(samples, sample_rate, config.envelope_window_ms);

    if envelope.is_empty() {
        return KickResult {
            is_kick: false,
            low_ratio,
            attack_slope: 0.0,
            decay_time_ms: f64::INFINITY,
        };
    }

    let attack_slope = max_attack_slope(&envelope, frame_duration_seconds);
    let decay_time_ms =
        decay_time_to_ratio_ms(&envelope, frame_duration_seconds, config.decay_level_ratio);

    let is_kick = low_ratio > config.low_ratio_threshold
        && attack_slope > config.attack_slope_threshold
        && decay_time_ms < config.max_decay_time_ms;

    KickResult {
        is_kick,
        low_ratio,
        attack_slope,
        decay_time_ms,
    }
}

fn compute_low_band_energy_ratio(
    samples: &[f32],
    sample_rate: u32,
    config: KickDetectionConfig,
) -> f64 {
    if sample_rate == 0 || samples.len() < config.fft_size {
        return 0.0;
    }

    let spectra = compute_stft(samples, config.fft_size, config.hop_size);
    if spectra.is_empty() {
        return 0.0;
    }

    let nyquist_bin = config.fft_size / 2;
    let bin_width_hz =
        f64::from(sample_rate) / f64::from(u32::try_from(config.fft_size).unwrap_or(1));
    if bin_width_hz <= f64::EPSILON {
        return 0.0;
    }

    #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
    {
        let start_bin =
            ((config.low_band_start_hz / bin_width_hz).ceil() as usize).min(nyquist_bin);
        let end_bin = ((config.low_band_end_hz / bin_width_hz).floor() as usize).min(nyquist_bin);

        if start_bin > end_bin {
            return 0.0;
        }

        let mut low_energy = 0.0;
        let mut total_energy = 0.0;

        for frame in &spectra {
            for (idx, magnitude) in frame.iter().enumerate() {
                let energy = f64::from(*magnitude).powi(2);
                total_energy += energy;

                if (start_bin..=end_bin).contains(&idx) {
                    low_energy += energy;
                }
            }
        }

        if total_energy <= f64::EPSILON {
            0.0
        } else {
            low_energy / total_energy
        }
    }
}

fn compute_abs_envelope(samples: &[f32], sample_rate: u32, window_ms: f64) -> (Vec<f32>, f64) {
    if sample_rate == 0 || samples.is_empty() {
        return (Vec::new(), 0.0);
    }

    #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
    let window_samples = ((f64::from(sample_rate) * window_ms / 1_000.0).round() as usize).max(1);
    #[allow(clippy::cast_precision_loss)]
    let frame_duration_seconds = window_samples as f64 / f64::from(sample_rate);
    let frame_count = samples.len().div_ceil(window_samples);
    let mut envelope = Vec::with_capacity(frame_count);

    for chunk in samples.chunks(window_samples) {
        #[allow(clippy::cast_precision_loss)]
        let mean_abs = chunk.iter().map(|sample| sample.abs()).sum::<f32>() / chunk.len() as f32;
        envelope.push(mean_abs);
    }

    (envelope, frame_duration_seconds)
}

fn max_attack_slope(envelope: &[f32], frame_duration_seconds: f64) -> f64 {
    if envelope.len() < 2 || frame_duration_seconds <= f64::EPSILON {
        return 0.0;
    }

    envelope
        .windows(2)
        .map(|pair| (f64::from(pair[1] - pair[0]) / frame_duration_seconds).max(0.0))
        .fold(0.0, f64::max)
}

fn decay_time_to_ratio_ms(
    envelope: &[f32],
    frame_duration_seconds: f64,
    decay_level_ratio: f64,
) -> f64 {
    if envelope.is_empty() || frame_duration_seconds <= f64::EPSILON {
        return f64::INFINITY;
    }

    let (peak_idx, peak_value) = envelope
        .iter()
        .copied()
        .enumerate()
        .max_by(|left, right| left.1.partial_cmp(&right.1).unwrap_or(Ordering::Equal))
        .unwrap_or((0, 0.0));

    if peak_value <= f32::EPSILON {
        return f64::INFINITY;
    }

    let target = f64::from(peak_value) * decay_level_ratio.clamp(0.0, 1.0);
    for (idx, value) in envelope.iter().enumerate().skip(peak_idx + 1) {
        if f64::from(*value) <= target {
            #[allow(clippy::cast_precision_loss)]
            return (idx - peak_idx) as f64 * frame_duration_seconds * 1_000.0;
        }
    }

    f64::INFINITY
}

#[cfg(test)]
mod tests {
    use std::f64::consts::PI;

    use super::*;

    #[test]
    fn detects_synthetic_kick_signal() {
        let sample_rate = 11_025u32;
        let samples = generate_kick_signal(sample_rate, 0.6);

        let result = detect_kick(&samples, sample_rate);

        assert!(result.is_kick, "result: {:?}", result);
        assert!(result.low_ratio > 0.6, "low_ratio: {}", result.low_ratio);
        assert!(
            result.decay_time_ms < 400.0,
            "decay_time_ms: {}",
            result.decay_time_ms
        );
    }

    #[test]
    fn does_not_detect_synthetic_snare_signal() {
        let sample_rate = 11_025u32;
        let samples = generate_snare_signal(sample_rate, 0.35);

        let result = detect_kick(&samples, sample_rate);

        assert!(!result.is_kick, "result: {:?}", result);
        assert!(result.low_ratio < 0.6, "low_ratio: {}", result.low_ratio);
    }

    #[test]
    fn silence_is_not_kick() {
        let sample_rate = 11_025u32;
        let samples = vec![0.0; sample_rate as usize / 2];

        let result = detect_kick(&samples, sample_rate);

        assert!(!result.is_kick);
        assert!(result.low_ratio <= 1e-6);
        assert!(result.attack_slope <= 1e-6);
    }

    #[test]
    fn short_signal_is_not_kick() {
        let sample_rate = 11_025u32;
        let samples = vec![0.0; 128];

        let result = detect_kick(&samples, sample_rate);

        assert!(!result.is_kick);
        assert_eq!(result.low_ratio, 0.0);
    }

    fn generate_kick_signal(sample_rate: u32, duration_seconds: f64) -> Vec<f32> {
        let total_samples = (sample_rate as f64 * duration_seconds) as usize;

        (0..total_samples)
            .map(|idx| {
                let t = idx as f64 / sample_rate as f64;
                let attack = (t / 0.008).min(1.0);
                let decay = (-t / 0.14).exp();
                let fundamental = (2.0 * PI * 62.0 * t).sin();
                let harmonic = (2.0 * PI * 124.0 * t).sin();
                (attack * decay * (0.9 * fundamental + 0.1 * harmonic)) as f32
            })
            .collect()
    }

    fn generate_snare_signal(sample_rate: u32, duration_seconds: f64) -> Vec<f32> {
        let total_samples = (sample_rate as f64 * duration_seconds) as usize;

        (0..total_samples)
            .map(|idx| {
                let t = idx as f64 / sample_rate as f64;
                let attack = (t / 0.003).min(1.0);
                let decay = (-t / 0.07).exp();
                let tone_a = (2.0 * PI * 1_800.0 * t).sin();
                let tone_b = (2.0 * PI * 3_200.0 * t).sin();
                (attack * decay * (0.65 * tone_a + 0.35 * tone_b)) as f32
            })
            .collect()
    }
}
