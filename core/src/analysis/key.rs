//! Musical key (pitch class) detection from audio samples using a chroma vector.
//!
//! This module returns only the pitch class (e.g. "C", "F#") with no major/minor
//! distinction. The algorithm sums spectral magnitudes into 12 chroma bins across
//! all STFT frames, then returns the dominant bin.

use super::fft_utils::{compute_stft, DEFAULT_FFT_SIZE, DEFAULT_HOP_SIZE};

const NOTE_NAMES: [&str; 12] = [
    "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
];

/// Detect the dominant pitch class of an audio signal.
///
/// Returns `Some(name)` where `name` is one of "C", "C#", ..., "B", or `None`
/// if input is empty/silent or too short to analyze.
#[must_use]
pub fn detect_key(samples: &[f32], sample_rate: u32) -> Option<String> {
    if samples.is_empty() || sample_rate == 0 {
        return None;
    }

    let frames = compute_stft(samples, DEFAULT_FFT_SIZE, DEFAULT_HOP_SIZE);
    if frames.is_empty() {
        return None;
    }

    let mut chroma = [0.0f64; 12];
    let sr = f64::from(sample_rate);

    for frame in &frames {
        for (bin, &mag) in frame.iter().enumerate().skip(1) {
            #[allow(clippy::cast_precision_loss)]
            let freq = bin as f64 * sr / DEFAULT_FFT_SIZE as f64;
            // Restrict to A0..C8 piano range to suppress noise/sub-bass artifacts.
            if !(27.5..=4186.0).contains(&freq) {
                continue;
            }
            // Map frequency to pitch class: 0=C, 1=C#, ..., 9=A, ..., 11=B.
            // 440Hz = A4 -> pitch class 9; offset by +9 so A maps to index 9.
            let pitch_class = ((12.0 * (freq / 440.0).log2() + 9.0)
                .round()
                .rem_euclid(12.0)) as usize
                % 12;
            chroma[pitch_class] += f64::from(mag);
        }
    }

    let total: f64 = chroma.iter().sum();
    if total == 0.0 {
        return None;
    }

    let max_idx = chroma
        .iter()
        .enumerate()
        .max_by(|a, b| a.1.partial_cmp(b.1).unwrap_or(std::cmp::Ordering::Equal))
        .map(|(i, _)| i)?;

    Some(NOTE_NAMES[max_idx].to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::f32::consts::PI;

    fn sine_wave(freq: f32, sample_rate: u32, duration_secs: f32) -> Vec<f32> {
        #[allow(clippy::cast_sign_loss, clippy::cast_possible_truncation)]
        let n = (sample_rate as f32 * duration_secs) as usize;
        (0..n)
            .map(|i| {
                #[allow(clippy::cast_precision_loss)]
                let t = i as f32 / sample_rate as f32;
                (2.0 * PI * freq * t).sin()
            })
            .collect()
    }

    #[test]
    fn test_440hz_returns_a() {
        let samples = sine_wave(440.0, 44100, 1.0);
        let key = detect_key(&samples, 44100);
        assert_eq!(key.as_deref(), Some("A"));
    }

    #[test]
    fn test_empty_returns_none() {
        assert_eq!(detect_key(&[], 44100), None);
    }

    #[test]
    fn test_silence_does_not_panic() {
        let silence = vec![0.0f32; 44100];
        // Should not panic; may return None
        let _ = detect_key(&silence, 44100);
    }

    #[test]
    fn test_zero_sample_rate_returns_none() {
        let samples = vec![0.1f32; 1024];
        assert_eq!(detect_key(&samples, 0), None);
    }
}
