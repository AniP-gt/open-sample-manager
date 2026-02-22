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
}

impl Default for LoopClassificationConfig {
    fn default() -> Self {
        Self {
            min_duration_seconds: 1.0,
            min_periodicity_strength: 0.3,
        }
    }
}

/// Classify audio as a loop or one-shot sample using default configuration.
///
/// Uses standard thresholds: minimum 1.0 second duration and 0.3 periodicity strength.
///
/// # Arguments
/// * `duration` - Duration of the audio sample in seconds
/// * `periodicity` - Periodicity strength score (0.0 to 1.0)
///
/// # Returns
/// LoopType indicating whether the audio is a Loop or OneShot.
pub fn classify_loop(duration: f64, periodicity: f64) -> LoopType {
    classify_loop_with_config(duration, periodicity, LoopClassificationConfig::default())
}

/// Classify audio as loop or one-shot with custom configuration parameters.
///
/// # Arguments
/// * `duration` - Duration of the audio sample in seconds
/// * `periodicity` - Periodicity strength score (0.0 to 1.0)
/// * `config` - Custom configuration with thresholds
///
/// # Returns
/// LoopType indicating whether the audio is a Loop or OneShot.
pub fn classify_loop_with_config(
    duration: f64,
    periodicity: f64,
    config: LoopClassificationConfig,
) -> LoopType {
    if !duration.is_finite() || !periodicity.is_finite() {
        return LoopType::OneShot;
    }

    if duration > config.min_duration_seconds && periodicity > config.min_periodicity_strength {
        LoopType::Loop
    } else {
        LoopType::OneShot
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_long_periodic_signal_as_loop() {
        let loop_type = classify_loop(3.8, 0.72);

        assert_eq!(loop_type, LoopType::Loop);
    }

    #[test]
    fn classifies_short_signal_as_one_shot() {
        let loop_type = classify_loop(0.6, 0.89);

        assert_eq!(loop_type, LoopType::OneShot);
    }

    #[test]
    fn classifies_low_periodicity_signal_as_one_shot() {
        let loop_type = classify_loop(2.2, 0.15);

        assert_eq!(loop_type, LoopType::OneShot);
    }

    #[test]
    fn boundary_values_are_one_shot() {
        assert_eq!(classify_loop(1.0, 0.8), LoopType::OneShot);
        assert_eq!(classify_loop(2.0, 0.3), LoopType::OneShot);
    }

    #[test]
    fn invalid_values_are_one_shot() {
        assert_eq!(classify_loop(f64::NAN, 0.9), LoopType::OneShot);
        assert_eq!(classify_loop(2.0, f64::INFINITY), LoopType::OneShot);
    }
}
