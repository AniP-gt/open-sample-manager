//! Integration tests for the full audio analysis pipeline.
//!
//! Tests the complete workflow: decode → estimate BPM → detect kick → classify loop

use std::path::PathBuf;

use open_sample_manager_core::{
    analysis::bpm::estimate_bpm, analysis::decoder::decode_to_mono_f32,
    analysis::kick::detect_kick, analysis::loop_classifier::classify_loop, LoopType,
};

/// Returns the path to the test fixtures directory.
fn fixtures_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures")
}

// ============================================================================
// INTEGRATION TESTS: Full Pipeline
// ============================================================================

/// Test the full pipeline on sine_440hz_1s.wav
/// Expected: No kick, one-shot (short pure tone)
#[test]
fn test_full_pipeline_sine_440hz() {
    let path = fixtures_dir().join("sine_440hz_1s.wav");

    // Step 1: Decode audio
    let audio = decode_to_mono_f32(&path).expect("Failed to decode sine_440hz_1s.wav");
    assert!(
        !audio.samples.is_empty(),
        "Decoded audio should have samples"
    );

    // Step 2: Estimate BPM (should be low confidence since it's a pure tone)
    let bpm_result = estimate_bpm(&audio.samples, audio.sample_rate);
    // For a pure sine wave, BPM estimation may give unreliable results
    // Just verify it doesn't crash
    assert!(bpm_result.bpm >= 0.0, "BPM should be non-negative");
    assert!(
        bpm_result.confidence >= 0.0,
        "Confidence should be non-negative"
    );

    // Step 3: Detect kick (should NOT be detected as kick)
    let kick_result = detect_kick(&audio.samples, audio.sample_rate);
    assert!(
        !kick_result.is_kick,
        "sine_440hz_1s.wav should not be detected as a kick"
    );

    // Step 4: Classify loop (should be one-shot, duration ~1s)
    let duration_seconds = audio.samples.len() as f64 / audio.sample_rate as f64;
    let loop_type = classify_loop(duration_seconds, bpm_result.periodicity_strength);
    assert_eq!(
        loop_type,
        LoopType::OneShot,
        "sine_440hz_1s.wav should be classified as one-shot (short duration)"
    );
}

/// Test the full pipeline on kick_808.wav
/// Expected: Strong kick characteristics (high low_ratio, fast attack, quick decay)
#[test]
fn test_full_pipeline_kick_808() {
    let path = fixtures_dir().join("kick_808.wav");

    // Step 1: Decode audio
    let audio = decode_to_mono_f32(&path).expect("Failed to decode kick_808.wav");
    assert!(
        !audio.samples.is_empty(),
        "Decoded audio should have samples"
    );

    // Step 2: Estimate BPM
    let bpm_result = estimate_bpm(&audio.samples, audio.sample_rate);
    assert!(bpm_result.bpm >= 0.0, "BPM should be non-negative");

    // Step 3: Detect kick characteristics
    let kick_result = detect_kick(&audio.samples, audio.sample_rate);
    assert!(
        kick_result.low_ratio > 0.5,
        "kick_808.wav should have strong low-frequency ratio (got: {:.3})",
        kick_result.low_ratio
    );
    assert!(
        kick_result.decay_time_ms < 500.0,
        "kick_808.wav should have quick decay (got: {:.3}ms)",
        kick_result.decay_time_ms
    );

    // Step 4: Classify loop (should be one-shot, short duration)
    let duration_seconds = audio.samples.len() as f64 / audio.sample_rate as f64;
    let loop_type = classify_loop(duration_seconds, bpm_result.periodicity_strength);
    assert_eq!(
        loop_type,
        LoopType::OneShot,
        "kick_808.wav should be classified as one-shot (short ~0.5s)"
    );
}

/// Test the full pipeline on snare.wav
/// Expected: Not detected as kick, one-shot
#[test]
fn test_full_pipeline_snare() {
    let path = fixtures_dir().join("snare.wav");

    // Step 1: Decode audio
    let audio = decode_to_mono_f32(&path).expect("Failed to decode snare.wav");
    assert!(
        !audio.samples.is_empty(),
        "Decoded audio should have samples"
    );

    // Step 2: Estimate BPM
    let bpm_result = estimate_bpm(&audio.samples, audio.sample_rate);
    assert!(bpm_result.bpm >= 0.0, "BPM should be non-negative");

    // Step 3: Detect kick (should NOT be detected as kick - snare is high-freq)
    let kick_result = detect_kick(&audio.samples, audio.sample_rate);
    assert!(
        !kick_result.is_kick,
        "snare.wav should not be detected as a kick (it's a high-frequency transient)"
    );

    // Step 4: Classify loop (should be one-shot, short duration ~0.2s)
    let duration_seconds = audio.samples.len() as f64 / audio.sample_rate as f64;
    let loop_type = classify_loop(duration_seconds, bpm_result.periodicity_strength);
    assert_eq!(
        loop_type,
        LoopType::OneShot,
        "snare.wav should be classified as one-shot (short ~0.2s)"
    );
}

/// Test the full pipeline on drum_loop_120bpm.wav
/// Expected: BPM ~120 (±10%), loop classification, kicks detected
#[test]
fn test_full_pipeline_drum_loop_120bpm() {
    let path = fixtures_dir().join("drum_loop_120bpm.wav");

    // Step 1: Decode audio
    let audio = decode_to_mono_f32(&path).expect("Failed to decode drum_loop_120bpm.wav");
    assert!(
        !audio.samples.is_empty(),
        "Decoded audio should have samples"
    );

    // Step 2: Estimate BPM (should be ~120 BPM with good confidence)
    let bpm_result = estimate_bpm(&audio.samples, audio.sample_rate);
    let expected_bpm = 120.0;
    let bpm_tolerance = expected_bpm * 0.10; // Allow ±10%

    assert!(
        (bpm_result.bpm - expected_bpm).abs() <= bpm_tolerance,
        "BPM should be ~120 (±10%), got: {}, tolerance: ±{}",
        bpm_result.bpm,
        bpm_tolerance
    );
    assert!(
        bpm_result.confidence > 0.0,
        "BPM confidence should be positive for a drum loop"
    );

    // Step 3: Detect kick (drum loop should have kicks present)
    let kick_result = detect_kick(&audio.samples, audio.sample_rate);
    assert!(
        kick_result.is_kick,
        "drum_loop_120bpm.wav should have kicks detected (low_ratio: {})",
        kick_result.low_ratio
    );

    // Step 4: Classify loop (should be classified as a loop, long duration ~8s)
    let duration_seconds = audio.samples.len() as f64 / audio.sample_rate as f64;
    let loop_type = classify_loop(duration_seconds, bpm_result.periodicity_strength);
    assert_eq!(
        loop_type, LoopType::Loop,
        "drum_loop_120bpm.wav should be classified as a loop (duration: {:.2}s, periodicity: {:.3})",
        duration_seconds,
        bpm_result.periodicity_strength
    );
}

// ============================================================================
// UNIT TESTS: Individual Components
// ============================================================================

/// Test that decoder correctly loads and downsamples audio
#[test]
fn test_decoder_loads_and_downsamples() {
    let path = fixtures_dir().join("sine_440hz_1s.wav");
    let audio = decode_to_mono_f32(&path).expect("Failed to decode audio");

    // Verify samples are in expected range
    for &sample in audio.samples.iter() {
        assert!(
            sample >= -1.0 && sample <= 1.0,
            "Decoded samples should be in [-1.0, 1.0] range, got: {}",
            sample
        );
    }

    // Verify sample rate is set to target
    assert_eq!(
        audio.sample_rate, 11025,
        "Sample rate should be downsampled to 11025 Hz"
    );
}

/// Test BPM accuracy on a known drum loop
#[test]
fn test_bpm_estimation_accuracy_on_drum_loop() {
    let path = fixtures_dir().join("drum_loop_120bpm.wav");
    let audio = decode_to_mono_f32(&path).expect("Failed to decode drum_loop_120bpm.wav");

    let result = estimate_bpm(&audio.samples, audio.sample_rate);

    let expected_bpm = 120.0;
    let tolerance = 12.0; // ±10%

    assert!(
        (result.bpm - expected_bpm).abs() <= tolerance,
        "BPM estimation failed: expected ~{}, got {:.2}, tolerance: ±{}",
        expected_bpm,
        result.bpm,
        tolerance
    );

    assert!(
        result.confidence > 0.2,
        "BPM confidence should be reasonable for a drum loop, got: {:.3}",
        result.confidence
    );
}

/// Test kick detection on kick fixture
#[test]
fn test_kick_detection_on_kick_fixture() {
    let path = fixtures_dir().join("kick_808.wav");
    let audio = decode_to_mono_f32(&path).expect("Failed to decode kick_808.wav");

    let result = detect_kick(&audio.samples, audio.sample_rate);

    assert!(
        result.low_ratio > 0.5,
        "Kick should have high low-frequency ratio (got: {:.3})",
        result.low_ratio
    );
    assert!(
        result.attack_slope > 10.0,
        "Kick should have fast attack slope (got: {:.3})",
        result.attack_slope
    );
    assert!(
        result.decay_time_ms < 500.0,
        "Kick should have quick decay (got: {:.3}ms)",
        result.decay_time_ms
    );
}

/// Test kick detection does not trigger on non-kick fixtures
#[test]
fn test_kick_detection_negative_cases() {
    let sine_path = fixtures_dir().join("sine_440hz_1s.wav");
    let sine_audio = decode_to_mono_f32(&sine_path).expect("Failed to decode sine_440hz_1s.wav");
    let sine_result = detect_kick(&sine_audio.samples, sine_audio.sample_rate);

    assert!(
        !sine_result.is_kick,
        "Sine wave should not be detected as kick"
    );

    let snare_path = fixtures_dir().join("snare.wav");
    let snare_audio = decode_to_mono_f32(&snare_path).expect("Failed to decode snare.wav");
    let snare_result = detect_kick(&snare_audio.samples, snare_audio.sample_rate);

    assert!(
        !snare_result.is_kick,
        "Snare should not be detected as kick (high-frequency content)"
    );
}

/// Test loop classification based on duration and periodicity
#[test]
fn test_loop_classification_short_duration() {
    // Short duration with high periodicity → OneShot
    let loop_type = classify_loop(0.5, 0.8);
    assert_eq!(
        loop_type,
        LoopType::OneShot,
        "Short duration should always be one-shot"
    );
}

#[test]
fn test_loop_classification_long_duration_high_periodicity() {
    // Long duration with high periodicity → Loop
    let loop_type = classify_loop(4.0, 0.5);
    assert_eq!(
        loop_type,
        LoopType::Loop,
        "Long duration with good periodicity should be loop"
    );
}

#[test]
fn test_loop_classification_long_duration_low_periodicity() {
    // Long duration with low periodicity → OneShot
    let loop_type = classify_loop(4.0, 0.1);
    assert_eq!(
        loop_type,
        LoopType::OneShot,
        "Long duration with poor periodicity should be one-shot"
    );
}
