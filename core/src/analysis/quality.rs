#[derive(Debug, Clone, PartialEq)]
pub struct QualityMetrics {
    pub peak_db: f64,
    pub rms_db: f64,
    pub leading_silence_ms: f64,
    pub clipping_count: i64,
    pub quality_flags: Vec<String>,
}

const MIN_DB: f64 = -120.0;
const SILENCE_THRESHOLD: f32 = 0.001;
const CLIPPING_THRESHOLD: f32 = 0.999;
const LOW_PEAK_DB: f64 = -40.0;
const LOW_RMS_DB: f64 = -60.0;
const LONG_LEADING_SILENCE_MS: f64 = 250.0;

pub fn compute_quality_metrics(samples: &[f32], sample_rate: u32) -> QualityMetrics {
    if samples.is_empty() || sample_rate == 0 {
        return QualityMetrics {
            peak_db: MIN_DB,
            rms_db: MIN_DB,
            leading_silence_ms: 0.0,
            clipping_count: 0,
            quality_flags: vec!["empty".to_string()],
        };
    }

    let peak = samples
        .iter()
        .map(|sample| sample.abs())
        .fold(0.0_f32, f32::max);
    let sum_squares = samples
        .iter()
        .map(|sample| f64::from(*sample) * f64::from(*sample))
        .sum::<f64>();
    let rms = (sum_squares / samples.len() as f64).sqrt();
    let leading_silent_samples = samples
        .iter()
        .take_while(|sample| sample.abs() < SILENCE_THRESHOLD)
        .count();
    let clipping_count = samples
        .iter()
        .filter(|sample| sample.abs() >= CLIPPING_THRESHOLD)
        .count() as i64;

    let peak_db = amplitude_to_db(f64::from(peak));
    let rms_db = amplitude_to_db(rms);
    let leading_silence_ms = leading_silent_samples as f64 * 1_000.0 / f64::from(sample_rate);
    let mut quality_flags = Vec::new();

    if clipping_count > 0 {
        quality_flags.push("clipping".to_string());
    }
    if leading_silence_ms >= LONG_LEADING_SILENCE_MS {
        quality_flags.push("leading_silence".to_string());
    }
    if peak_db <= LOW_PEAK_DB {
        quality_flags.push("low_peak".to_string());
    }
    if rms_db <= LOW_RMS_DB {
        quality_flags.push("low_rms".to_string());
    }

    QualityMetrics {
        peak_db,
        rms_db,
        leading_silence_ms,
        clipping_count,
        quality_flags,
    }
}

fn amplitude_to_db(amplitude: f64) -> f64 {
    if amplitude <= 0.0 {
        MIN_DB
    } else {
        (20.0 * amplitude.log10()).max(MIN_DB)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn computes_peak_rms_and_silence() {
        let samples = vec![0.0; 500]
            .into_iter()
            .chain([0.5_f32, -0.5, 1.0, -1.0])
            .collect::<Vec<_>>();

        let metrics = compute_quality_metrics(&samples, 1_000);

        assert!((metrics.peak_db - 0.0).abs() < 1e-6);
        assert_eq!(metrics.leading_silence_ms, 500.0);
        assert_eq!(metrics.clipping_count, 2);
        assert!(metrics.quality_flags.contains(&"clipping".to_string()));
        assert!(metrics
            .quality_flags
            .contains(&"leading_silence".to_string()));
    }

    #[test]
    fn empty_input_returns_empty_flag() {
        let metrics = compute_quality_metrics(&[], 44_100);

        assert_eq!(metrics.peak_db, MIN_DB);
        assert_eq!(metrics.rms_db, MIN_DB);
        assert_eq!(metrics.quality_flags, vec!["empty".to_string()]);
    }
}
