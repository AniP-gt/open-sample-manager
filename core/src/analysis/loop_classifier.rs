/// Classification result indicating whether audio is a loop or one-shot sample.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LoopType {
    /// Audio sample that repeats periodically (loop).
    Loop,
    /// One-shot or non-repeating audio sample.
    OneShot,
}

/// Configuration parameters for loop vs one-shot classification algorithm.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct LoopClassificationConfig {
    /// Minimum audio duration in seconds to be classified as a loop.
    pub min_duration_seconds: f64,
    /// Minimum periodicity strength (0.0 to 1.0) to qualify as a loop.
    pub min_periodicity_strength: f64,
    /// Minimum energy ratio (E_end / E_start) to qualify as a loop.
    /// Values close to 1.0 indicate sustained energy (loop).
    /// Values much less than 1.0 indicate decay (one-shot).
    pub min_energy_ratio: f64,
}

impl Default for LoopClassificationConfig {
    fn default() -> Self {
        Self {
            min_duration_seconds: 1.5,
            min_periodicity_strength: 0.3,
            // Energy decay ratio threshold: E_end / E_start
            // Values < 0.3 indicate significant decay (one-shot characteristics)
            min_energy_ratio: 0.3,
        }
    }
}

/// Compute energy decay ratio from audio samples.
///
/// Calculates the ratio of end energy to start energy:
/// - Loop: E_end / E_start ≈ 1.0 (sustained energy)
/// - One-shot: E_end / E_start << 1.0 (decaying energy)
///
/// Uses RMS (root mean square) as the energy metric.
#[allow(clippy::cast_precision_loss)]
pub fn compute_energy_ratio(samples: &[f32]) -> f64 {
    if samples.len() < 2 {
        return 0.0;
    }

    let len = samples.len();
    let quarter = len / 4;

    if quarter < 1 {
        return 0.0;
    }

    // Energy in first quarter (start)
    let start_energy = compute_rms(&samples[..quarter]);

    // Energy in last quarter (end)
    let end_start = len.saturating_sub(quarter);
    let end_samples = &samples[end_start..];
    let end_energy = compute_rms(end_samples);

    if start_energy < f32::EPSILON {
        return 0.0;
    }

    (end_energy / start_energy) as f64
}

/// Compute RMS (root mean square) of samples.
fn compute_rms(samples: &[f32]) -> f32 {
    if samples.is_empty() {
        return 0.0;
    }

    let sum_squares: f32 = samples.iter().map(|&s| s * s).sum();
    (sum_squares / samples.len() as f32).sqrt()
}

/// Classify audio as a loop or one-shot sample using default configuration.
///
/// Uses standard thresholds:
/// - Minimum 1.5 second duration
/// - Minimum 0.3 periodicity strength
/// - Minimum 0.3 energy ratio (E_end / E_start)
///
/// # Arguments
/// * `duration` - Duration of the audio sample in seconds
/// * `periodicity` - Periodicity strength score (0.0 to 1.0)
/// * `energy_ratio` - Energy decay ratio (E_end / E_start), 0.0 to 1.0
///
/// # Returns
/// `LoopType` indicating whether the audio is a Loop or `OneShot`.
#[must_use]
pub fn classify_loop(duration: f64, periodicity: f64, energy_ratio: f64) -> LoopType {
    classify_loop_with_config(
        duration,
        periodicity,
        energy_ratio,
        LoopClassificationConfig::default(),
    )
}

/// Classify audio as loop or one-shot with custom configuration parameters.
///
/// Uses 3-element classification:
/// 1. Duration: must exceed min_duration_seconds
/// 2. Periodicity: must exceed min_periodicity_strength
/// 3. Energy ratio: must exceed min_energy_ratio
///
/// # Arguments
/// * `duration` - Duration of the audio sample in seconds
/// * `periodicity` - Periodicity strength score (0.0 to 1.0)
/// * `energy_ratio` - Energy decay ratio (E_end / E_start)
/// * `config` - Custom configuration with thresholds
///
/// # Returns
/// `LoopType` indicating whether the audio is a Loop or `OneShot`.
#[must_use]
pub fn classify_loop_with_config(
    duration: f64,
    periodicity: f64,
    energy_ratio: f64,
    config: LoopClassificationConfig,
) -> LoopType {
    if !duration.is_finite() || !periodicity.is_finite() || !energy_ratio.is_finite() {
        return LoopType::OneShot;
    }

    // All three conditions must be met for Loop classification
    let duration_ok = duration > config.min_duration_seconds;
    let periodicity_ok = periodicity > config.min_periodicity_strength;
    let energy_ok = energy_ratio > config.min_energy_ratio;

    if duration_ok && periodicity_ok && energy_ok {
        LoopType::Loop
    } else {
        LoopType::OneShot
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_long_periodic_sustained_signal_as_loop() {
        // duration > 1.5, periodicity > 0.3, energy_ratio > 0.3
        let loop_type = classify_loop(3.8, 0.72, 0.5);

        assert_eq!(loop_type, LoopType::Loop);
    }

    #[test]
    fn classifies_short_signal_as_one_shot() {
        // duration <= 1.5
        let loop_type = classify_loop(0.6, 0.89, 0.8);

        assert_eq!(loop_type, LoopType::OneShot);
    }

    #[test]
    fn classifies_low_periodicity_signal_as_one_shot() {
        // periodicity <= 0.3
        let loop_type = classify_loop(2.2, 0.15, 0.8);

        assert_eq!(loop_type, LoopType::OneShot);
    }

    #[test]
    fn classifies_low_energy_ratio_as_one_shot() {
        // energy_ratio <= 0.3 (significant decay)
        let loop_type = classify_loop(2.2, 0.7, 0.1);

        assert_eq!(loop_type, LoopType::OneShot);
    }

    #[test]
    fn classifies_sustained_energy_as_loop() {
        // High energy ratio (sustained throughout)
        let loop_type = classify_loop(2.0, 0.5, 0.9);

        assert_eq!(loop_type, LoopType::Loop);
    }

    #[test]
    fn boundary_values_are_one_shot() {
        // Exactly at thresholds are considered OneShot (>)
        assert_eq!(classify_loop(1.5, 0.8, 0.5), LoopType::OneShot);
        assert_eq!(classify_loop(2.0, 0.3, 0.5), LoopType::OneShot);
        assert_eq!(classify_loop(2.0, 0.5, 0.3), LoopType::OneShot);
    }

    #[test]
    fn invalid_values_are_one_shot() {
        assert_eq!(classify_loop(f64::NAN, 0.9, 0.5), LoopType::OneShot);
        assert_eq!(classify_loop(2.0, f64::INFINITY, 0.5), LoopType::OneShot);
        assert_eq!(classify_loop(2.0, 0.5, f64::NAN), LoopType::OneShot);
    }

    #[test]
    fn computes_energy_ratio_for_decaying_signal() {
        // Create a decaying signal: loud first half, quiet second half
        let mut samples = vec![0.0f32; 1000];
        for (i, sample) in samples.iter_mut().enumerate() {
            if i < 500 {
                *sample = 1.0;
            } else {
                *sample = 0.1;
            }
        }

        let ratio = compute_energy_ratio(&samples);
        // End energy should be much lower than start energy
        assert!(ratio < 0.2, "ratio: {}", ratio);
    }

    #[test]
    fn computes_energy_ratio_for_sustained_signal() {
        // Create a sustained signal: similar energy throughout
        let samples: Vec<f32> = (0..1000).map(|i| (i as f32 * 0.01).sin()).collect();

        let ratio = compute_energy_ratio(&samples);
        // End energy should be similar to start energy
        assert!(ratio > 0.5, "ratio: {}", ratio);
    }

    #[test]
    fn computes_energy_ratio_for_empty_signal() {
        let samples: Vec<f32> = vec![];
        let ratio = compute_energy_ratio(&samples);
        assert_eq!(ratio, 0.0);
    }
}
