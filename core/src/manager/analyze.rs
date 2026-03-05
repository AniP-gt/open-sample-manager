use std::path::Path;

use crate::analysis::bpm::estimate_bpm;
use crate::analysis::decoder::decode_to_mono_f32;
use crate::analysis::kick::detect_kick;
use crate::analysis::loop_classifier::{classify_loop, compute_energy_ratio, LoopType};
use crate::db::operations::{insert_sample, SampleInput};

use super::audio::{compute_waveform_peaks, extract_artist};
use super::ManagerError;

/// Decode and analyze a single audio file, returning a [`SampleInput`].
pub(super) fn analyze(file_path: &Path) -> Result<SampleInput, ManagerError> {
    let artist = extract_artist(file_path);
    let decoded = decode_to_mono_f32(file_path)?;

    let bpm_result = estimate_bpm(&decoded.samples, decoded.sample_rate);
    let kick_result = detect_kick(&decoded.samples, decoded.sample_rate);

    #[allow(clippy::cast_precision_loss)]
    let duration = decoded.samples.len() as f64 / f64::from(decoded.sample_rate);
    let energy_ratio = compute_energy_ratio(&decoded.samples);
    let loop_type = classify_loop(duration, bpm_result.periodicity_strength, energy_ratio);

    let (playback_type, instrument_type) = if kick_result.is_kick {
        ("oneshot", "kick")
    } else {
        let pt = match loop_type {
            LoopType::Loop => "loop",
            LoopType::OneShot => "oneshot",
        };
        (pt, "other")
    };

    let sample_type = if kick_result.is_kick {
        "kick".to_string()
    } else {
        playback_type.to_string()
    };

    let file_name = file_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();
    let path_str = file_path.to_str().unwrap_or_default().to_string();
    let waveform_peaks = compute_waveform_peaks(&decoded.samples, 64);
    let sample_rate = decoded.sample_rate as i64;
    let file_size = std::fs::metadata(file_path).ok().map(|m| m.len() as i64);

    let emb_vec = crate::embedding::generate_embedding(&decoded.samples, decoded.sample_rate);
    let mut emb_bytes: Vec<u8> = Vec::with_capacity(emb_vec.len() * 4);
    for v in &emb_vec {
        emb_bytes.extend_from_slice(&v.to_le_bytes());
    }

    Ok(SampleInput {
        path: path_str,
        file_name,
        duration: Some(duration),
        bpm: Some(bpm_result.bpm),
        periodicity: Some(bpm_result.periodicity_strength),
        sample_rate: Some(sample_rate),
        file_size,
        artist,
        low_ratio: Some(kick_result.low_ratio),
        attack_slope: Some(kick_result.attack_slope),
        decay_time: Some(kick_result.decay_time_ms),
        sample_type: Some(sample_type),
        waveform_peaks: Some(waveform_peaks),
        embedding: Some(emb_bytes),
        playback_type: Some(playback_type.to_string()),
        instrument_type: Some(instrument_type.to_string()),
    })
}

/// Analyze a file and insert the result into the database.
pub(super) fn analyze_and_store(
    conn: &rusqlite::Connection,
    file_path: &Path,
) -> Result<i64, ManagerError> {
    let input = analyze(file_path)?;
    let id = insert_sample(conn, &input)?;
    Ok(id)
}
