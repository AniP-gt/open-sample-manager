//! Private audio utility helpers: waveform peak computation and artist tag extraction.

use std::fs::File;
use std::path::Path;

use symphonia::core::formats::FormatOptions;
use symphonia::core::io::{MediaSourceStream, MediaSourceStreamOptions};
use symphonia::core::meta::StandardTagKey;
use symphonia::core::probe::Hint;
use symphonia::default::get_probe;

/// Compute `num_peaks` peak amplitude values for waveform visualization.
///
/// Returns a JSON array string (e.g. `"[0.123456,0.234567,…]"`).
pub(super) fn compute_waveform_peaks(samples: &[f32], num_peaks: usize) -> String {
    if samples.is_empty() || num_peaks == 0 {
        return "[]".to_string();
    }

    let samples_per_peak = (samples.len() + num_peaks - 1) / num_peaks;
    let mut peaks: Vec<f32> = Vec::with_capacity(num_peaks);

    for i in 0..num_peaks {
        let start = i * samples_per_peak;
        let end = (start + samples_per_peak).min(samples.len());
        if start >= samples.len() {
            break;
        }
        let chunk = &samples[start..end];
        let max_abs = chunk.iter().map(|&s| s.abs()).fold(0.0f32, |a, b| a.max(b));
        peaks.push(max_abs);
    }

    let json: Vec<String> = peaks.iter().map(|p| format!("{:.6}", p)).collect();
    format!("[{}]", json.join(","))
}

/// Best-effort extraction of artist metadata using Symphonia.
///
/// Returns `Some(String)` when an artist tag is found, otherwise `None`.
pub(super) fn extract_artist(path: &Path) -> Option<String> {
    let file = File::open(path).ok()?;
    let mss = MediaSourceStream::new(Box::new(file), MediaSourceStreamOptions::default());

    let probed = get_probe()
        .format(
            &Hint::default(),
            mss,
            &FormatOptions::default(),
            &Default::default(),
        )
        .ok()?;

    let mut format = probed.format;
    let metadata = format.metadata();
    let rev = metadata.current();
    let tags = match rev {
        Some(r) => r.tags(),
        None => &[],
    };

    // Prefer standardized Artist tag when present
    for tag in tags.iter() {
        if let Some(std_key) = tag.std_key {
            if std_key == StandardTagKey::Artist {
                let v = tag.value.to_string();
                let v = v.trim_end_matches('\0').trim().to_string();
                return Some(v);
            }
        }
    }

    // Fallback: look for keys containing 'artist' (case-insensitive) or common vendor keys
    for tag in tags.iter() {
        let key = tag.key.to_lowercase();
        if key.contains("artist") || key == "©art" || key == "art" || key == "iart" {
            let v = tag.value.to_string();
            let v = v.trim_end_matches('\0').trim().to_string();
            return Some(v);
        }
    }

    None
}
