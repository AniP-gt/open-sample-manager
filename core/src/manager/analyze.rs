use std::io::Read as _;
use std::path::Path;

use crate::analysis::bpm::estimate_bpm;
use crate::analysis::decoder::decode_to_mono_f32;
use crate::analysis::key::detect_key;
use crate::analysis::kick::detect_kick;
use crate::analysis::loop_classifier::{classify_loop, compute_energy_ratio, LoopType};
use crate::analysis::quality::compute_quality_metrics;
use crate::db::operations::{insert_sample, SampleInput};

use super::audio::{compute_waveform_peaks, extract_artist};
use super::ManagerError;

/// Infer instrument type from file name keywords.
/// Returns one of the seeded instrument_types: kick, snare, hihat, bass, synth, fx, vocal, percussion, other.
fn infer_instrument_type_from_filename(file_name: &str) -> &'static str {
    let lower = file_name.to_lowercase();
    let stem = lower.rfind('.').map(|i| &lower[..i]).unwrap_or(&lower);

    // Check each instrument type against known keywords.
    // Order matters: more specific matches should come before generic ones.
    let kick_keywords = ["kick", "bd", "bassdrum", "bass_drum"];
    let snare_keywords = ["snare", "snr", "sd", "rimshot", "rim"];
    let hihat_keywords = [
        "hihat",
        "hi_hat",
        "hi-hat",
        "hhat",
        "hh",
        "cymbal",
        "crash",
        "ride",
        "open_hat",
        "closed_hat",
        "openhat",
        "closedhat",
    ];
    let bass_keywords = ["bass", "sub", "808"];
    let synth_keywords = [
        "synth", "lead", "pad", "arp", "keys", "piano", "organ", "pluck",
    ];
    let fx_keywords = [
        "fx",
        "sfx",
        "effect",
        "riser",
        "downlifter",
        "uplifter",
        "sweep",
        "transition",
        "impact",
        "noise",
        "atmo",
        "atmosphere",
        "ambience",
        "ambient",
        "texture",
        "foley",
    ];
    let vocal_keywords = ["vocal", "vox", "voice", "choir", "chant", "sing"];
    let percussion_keywords = [
        "perc",
        "percussion",
        "conga",
        "bongo",
        "tom",
        "clap",
        "shaker",
        "tamb",
        "cowbell",
        "woodblock",
        "claves",
        "maracas",
        "cabasa",
        "guiro",
        "triangle",
    ];

    if kick_keywords.iter().any(|kw| contains_word(stem, kw)) {
        return "kick";
    }
    if snare_keywords.iter().any(|kw| contains_word(stem, kw)) {
        return "snare";
    }
    if hihat_keywords.iter().any(|kw| contains_word(stem, kw)) {
        return "hihat";
    }
    if bass_keywords.iter().any(|kw| contains_word(stem, kw)) {
        return "bass";
    }
    if synth_keywords.iter().any(|kw| contains_word(stem, kw)) {
        return "synth";
    }
    if fx_keywords.iter().any(|kw| contains_word(stem, kw)) {
        return "fx";
    }
    if vocal_keywords.iter().any(|kw| contains_word(stem, kw)) {
        return "vocal";
    }
    if percussion_keywords.iter().any(|kw| contains_word(stem, kw)) {
        return "percussion";
    }

    "other"
}

/// Check if `stem` contains `keyword` as a standalone word segment.
/// Before the keyword: must be start-of-string or a non-alphanumeric character.
/// After the keyword: must be end-of-string, a non-alphanumeric character, or a digit
/// (so "HH01" and "BD_01" both match "hh" and "bd" respectively).
fn contains_word(stem: &str, keyword: &str) -> bool {
    if !stem.contains(keyword) {
        return false;
    }
    let klen = keyword.len();
    let bytes = stem.as_bytes();
    let kbytes = keyword.as_bytes();
    let mut i = 0;
    while i + klen <= bytes.len() {
        if &bytes[i..i + klen] == kbytes {
            let before_ok = i == 0 || !bytes[i - 1].is_ascii_alphanumeric();
            // Digits following a keyword are treated as a boundary so that
            // common sample-pack patterns like "HH01" or "SD02" are matched.
            let after_ok = i + klen == bytes.len() || !bytes[i + klen].is_ascii_alphabetic();
            if before_ok && after_ok {
                return true;
            }
        }
        i += 1;
    }
    false
}

/// Decode and analyze a single audio file, returning a [`SampleInput`].
pub(super) fn analyze(file_path: &Path) -> Result<SampleInput, ManagerError> {
    let artist = extract_artist(file_path);
    let decoded = decode_to_mono_f32(file_path)?;

    let bpm_result = estimate_bpm(&decoded.samples, decoded.sample_rate);
    let kick_result = detect_kick(&decoded.samples, decoded.sample_rate);
    let musical_key = detect_key(&decoded.samples, decoded.sample_rate);
    let quality_metrics = compute_quality_metrics(&decoded.samples, decoded.sample_rate);

    #[allow(clippy::cast_precision_loss)]
    let duration = decoded.samples.len() as f64 / f64::from(decoded.sample_rate);
    let energy_ratio = compute_energy_ratio(&decoded.samples);
    let loop_type = classify_loop(duration, bpm_result.periodicity_strength, energy_ratio);

    let file_name = file_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    let (playback_type, instrument_type) = if kick_result.is_kick {
        ("oneshot", "kick")
    } else {
        let pt = match loop_type {
            LoopType::Loop => "loop",
            LoopType::OneShot => "oneshot",
        };
        let it = infer_instrument_type_from_filename(&file_name);
        (pt, it)
    };

    let sample_type = if kick_result.is_kick {
        "kick".to_string()
    } else {
        playback_type.to_string()
    };

    let path_str = file_path.to_str().unwrap_or_default().to_string();
    let waveform_peaks = compute_waveform_peaks(&decoded.samples, 64);
    let sample_rate = decoded.sample_rate as i64;
    let file_size = std::fs::metadata(file_path).ok().map(|m| m.len() as i64);
    let content_hash = hash_file_contents(file_path)?;

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
        source: None,
        pack_name: None,
        license: None,
        license_url: None,
        license_memo: None,
        imported_at: None,
        peak_db: Some(quality_metrics.peak_db),
        rms_db: Some(quality_metrics.rms_db),
        leading_silence_ms: Some(quality_metrics.leading_silence_ms),
        clipping_count: Some(quality_metrics.clipping_count),
        channel_count: decoded.channel_count.map(|count| count as i64),
        bit_depth: decoded.bit_depth.map(i64::from),
        quality_flags: Some(
            serde_json::to_string(&quality_metrics.quality_flags)
                .unwrap_or_else(|_| "[]".to_string()),
        ),
        playback_type: Some(playback_type.to_string()),
        instrument_type: Some(instrument_type.to_string()),
        musical_key,
        content_hash: Some(content_hash),
    })
}

fn hash_file_contents(file_path: &Path) -> Result<String, ManagerError> {
    const FNV_OFFSET: u64 = 0xcbf29ce484222325;
    const FNV_PRIME: u64 = 0x100000001b3;

    let mut hash = FNV_OFFSET;

    let mut file = std::fs::File::open(file_path)?;
    let mut buffer = [0_u8; 8192];
    loop {
        let read = file.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        for byte in &buffer[..read] {
            hash ^= u64::from(*byte);
            hash = hash.wrapping_mul(FNV_PRIME);
        }
    }

    Ok(format!("{hash:016x}"))
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_infer_kick() {
        assert_eq!(infer_instrument_type_from_filename("kick_808.wav"), "kick");
        assert_eq!(infer_instrument_type_from_filename("BD_hard.wav"), "kick");
        assert_eq!(
            infer_instrument_type_from_filename("bassdrum_01.wav"),
            "kick"
        );
    }

    #[test]
    fn test_infer_snare() {
        assert_eq!(
            infer_instrument_type_from_filename("snare_tight.wav"),
            "snare"
        );
        assert_eq!(infer_instrument_type_from_filename("SNR_01.wav"), "snare");
        assert_eq!(infer_instrument_type_from_filename("rimshot.wav"), "snare");
    }

    #[test]
    fn test_infer_hihat() {
        assert_eq!(
            infer_instrument_type_from_filename("hihat_open.wav"),
            "hihat"
        );
        assert_eq!(
            infer_instrument_type_from_filename("HH_closed.wav"),
            "hihat"
        );
        assert_eq!(
            infer_instrument_type_from_filename("crash_cymbal.wav"),
            "hihat"
        );
    }

    #[test]
    fn test_infer_bass() {
        assert_eq!(infer_instrument_type_from_filename("bass_loop.wav"), "bass");
        assert_eq!(infer_instrument_type_from_filename("sub_bass.wav"), "bass");
        assert_eq!(infer_instrument_type_from_filename("808_bass.wav"), "bass");
    }

    #[test]
    fn test_infer_synth() {
        assert_eq!(
            infer_instrument_type_from_filename("synth_lead.wav"),
            "synth"
        );
        assert_eq!(infer_instrument_type_from_filename("pad_warm.wav"), "synth");
        assert_eq!(
            infer_instrument_type_from_filename("piano_chord.wav"),
            "synth"
        );
    }

    #[test]
    fn test_infer_fx() {
        assert_eq!(infer_instrument_type_from_filename("fx_riser.wav"), "fx");
        assert_eq!(infer_instrument_type_from_filename("sfx_impact.wav"), "fx");
        assert_eq!(
            infer_instrument_type_from_filename("transition_sweep.wav"),
            "fx"
        );
    }

    #[test]
    fn test_infer_vocal() {
        assert_eq!(
            infer_instrument_type_from_filename("vocal_chop.wav"),
            "vocal"
        );
        assert_eq!(infer_instrument_type_from_filename("vox_dry.wav"), "vocal");
        assert_eq!(
            infer_instrument_type_from_filename("choir_hit.wav"),
            "vocal"
        );
    }

    #[test]
    fn test_infer_percussion() {
        assert_eq!(
            infer_instrument_type_from_filename("perc_shaker.wav"),
            "percussion"
        );
        assert_eq!(
            infer_instrument_type_from_filename("conga_hit.wav"),
            "percussion"
        );
        assert_eq!(
            infer_instrument_type_from_filename("clap_dry.wav"),
            "percussion"
        );
    }

    #[test]
    fn test_infer_other() {
        assert_eq!(
            infer_instrument_type_from_filename("unknown_sample.wav"),
            "other"
        );
        assert_eq!(
            infer_instrument_type_from_filename("sample_01.wav"),
            "other"
        );
    }

    #[test]
    fn test_no_partial_word_match() {
        // "hh" should not match "rhythm" or "shh"
        assert_ne!(
            infer_instrument_type_from_filename("rhythm_guitar.wav"),
            "hihat"
        );
        // "bass" in "contrabass" — contrabass contains "bass" at word boundary after 'contra'
        // 'a' before 'bass' is alphanumeric so it won't match as a word
        assert_eq!(
            infer_instrument_type_from_filename("contrabass.wav"),
            "other"
        );
    }

    #[test]
    fn test_numeric_suffix_matches() {
        // Industry-standard sample pack naming: abbreviation directly followed by number
        assert_eq!(infer_instrument_type_from_filename("HH01.wav"), "hihat");
        assert_eq!(infer_instrument_type_from_filename("BD01.wav"), "kick");
        assert_eq!(infer_instrument_type_from_filename("SD02.wav"), "snare");
        assert_eq!(
            infer_instrument_type_from_filename("perc01.wav"),
            "percussion"
        );
    }

    #[test]
    fn test_kick_takes_priority_over_bass_in_filename() {
        // "kick_bass" should be classified as kick (first match wins)
        assert_eq!(infer_instrument_type_from_filename("kick_bass.wav"), "kick");
    }
}
