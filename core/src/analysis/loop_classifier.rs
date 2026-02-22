#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LoopType {
    Loop,
    OneShot,
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct LoopClassificationConfig {
    pub min_duration_seconds: f64,
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

pub fn classify_loop(duration: f64, periodicity: f64) -> LoopType {
    classify_loop_with_config(duration, periodicity, LoopClassificationConfig::default())
}

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
