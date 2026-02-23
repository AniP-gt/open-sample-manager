use super::fft_utils::{compute_stft, DEFAULT_FFT_SIZE, DEFAULT_HOP_SIZE};

/// Compute spectral flux to detect changes in frequency content across frames.
///
/// Calculates the magnitude changes in the frequency domain between consecutive frames,
/// which indicates transients and onsets in the audio signal.
///
/// # Arguments
/// * `spectra` - Vector of frequency-domain spectral frames
///
/// # Returns
/// Vector of spectral flux values (one per frame).
#[must_use]
pub fn compute_spectral_flux(spectra: &[Vec<f32>]) -> Vec<f32> {
    if spectra.is_empty() {
        return Vec::new();
    }

    let mut flux = vec![0.0; spectra.len()];

    for frame_idx in 1..spectra.len() {
        let previous = &spectra[frame_idx - 1];
        let current = &spectra[frame_idx];
        let mut frame_flux = 0.0;

        for (current_bin, previous_bin) in current.iter().zip(previous.iter()) {
            let diff = current_bin - previous_bin;
            if diff > 0.0 {
                frame_flux += diff;
            }
        }

        flux[frame_idx] = frame_flux;
    }

    flux
}

/// Normalize spectral flux to zero mean and unit variance.
///
/// Standardizes flux values to improve onset detection robustness across
/// different audio levels and frequency content distributions.
///
/// # Arguments
/// * `flux` - Spectral flux values to normalize
///
/// # Returns
/// Vector of normalized flux values (z-scored).
#[must_use]
#[allow(clippy::cast_precision_loss)]
pub fn normalize_flux(flux: &[f32]) -> Vec<f32> {
    if flux.is_empty() {
        return Vec::new();
    }

    let mean = flux.iter().sum::<f32>() / flux.len() as f32;
    let variance = flux
        .iter()
        .map(|value| {
            let centered = value - mean;
            centered * centered
        })
        .sum::<f32>()
        / flux.len() as f32;
    let std_dev = variance.sqrt();

    if std_dev <= f32::EPSILON {
        return vec![0.0; flux.len()];
    }

    flux.iter().map(|value| (value - mean) / std_dev).collect()
}

/// Detect onset times in audio samples using spectral flux analysis.
///
/// Identifies transient events (note attacks, percussive hits) by analyzing
/// changes in the frequency spectrum and finding local peaks in spectral flux.
///
/// # Arguments
/// * `samples` - Audio samples to analyze
/// * `sample_rate` - Sample rate in Hz (e.g., 44100)
/// * `threshold` - Detection threshold for normalized spectral flux
///
/// # Returns
/// Vector of onset times in seconds.
#[must_use]
pub fn detect_onsets(samples: &[f32], sample_rate: u32, threshold: f32) -> Vec<f64> {
    if sample_rate == 0 {
        return Vec::new();
    }

    let spectra = compute_stft(samples, DEFAULT_FFT_SIZE, DEFAULT_HOP_SIZE);
    if spectra.is_empty() {
        return Vec::new();
    }

    let flux = compute_spectral_flux(&spectra);
    let normalized_flux = normalize_flux(&flux);
    let mut onsets = Vec::new();

    for (frame_idx, value) in normalized_flux.iter().enumerate() {
        if *value <= threshold {
            continue;
        }

        let left_ok = frame_idx == 0 || *value >= normalized_flux[frame_idx - 1];
        let right_ok =
            frame_idx + 1 == normalized_flux.len() || *value > normalized_flux[frame_idx + 1];

        if left_ok && right_ok {
            let time_seconds = (f64::from(u32::try_from(frame_idx).unwrap_or(0))
                * f64::from(u32::try_from(DEFAULT_HOP_SIZE).unwrap_or(1)))
                / f64::from(sample_rate);
            onsets.push(time_seconds);
        }
    }

    onsets
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn constant_signal_has_near_zero_spectral_flux() {
        let samples = vec![1.0; 44_100];
        let spectra = compute_stft(&samples, DEFAULT_FFT_SIZE, DEFAULT_HOP_SIZE);
        let flux = compute_spectral_flux(&spectra);

        assert!(!flux.is_empty());
        assert!(flux.iter().all(|value| value.abs() < 1e-6));
    }

    #[test]
    fn impulse_signal_has_single_flux_peak() {
        let mut samples = vec![0.0; 4_096];
        samples[1_536] = 1.0;

        let spectra = compute_stft(&samples, DEFAULT_FFT_SIZE, DEFAULT_HOP_SIZE);
        let flux = compute_spectral_flux(&spectra);
        let positive_flux_count = flux.iter().filter(|value| **value > 1e-6).count();

        assert_eq!(positive_flux_count, 1);
    }

    #[test]
    fn detects_expected_number_of_onsets() {
        let sample_rate = 11_025u32;
        let mut samples = vec![0.0; 8_192];
        samples[1_536] = 1.0;
        samples[4_608] = 1.0;

        let onsets = detect_onsets(&samples, sample_rate, 1.0);

        assert_eq!(onsets.len(), 2);

        let expected_first = (2 * DEFAULT_HOP_SIZE) as f64 / sample_rate as f64;
        let expected_second = (8 * DEFAULT_HOP_SIZE) as f64 / sample_rate as f64;

        assert!((onsets[0] - expected_first).abs() < 1e-6);
        assert!((onsets[1] - expected_second).abs() < 1e-6);
    }

    #[test]
    fn handles_empty_inputs() {
        assert!(compute_spectral_flux(&[]).is_empty());
        assert!(normalize_flux(&[]).is_empty());
        assert!(detect_onsets(&[], 11_025, 1.0).is_empty());
    }
}
