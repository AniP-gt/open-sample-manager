//! MIDI file metadata extraction using the `midly` crate.
//!
//! Parses Standard MIDI Files (SMF) to extract tempo, duration, time signature,
//! track count, note count, channel count, and a rough key estimate.

use std::collections::HashSet;
use std::path::Path;

use midly::{MetaMessage, MidiMessage, Smf, Timing, TrackEventKind};

/// Extracted metadata from a MIDI file.
#[derive(Debug, Clone, Default)]
pub struct ParsedMidi {
    /// File duration in seconds.
    pub duration: Option<f64>,
    /// Tempo in BPM (first occurrence wins).
    pub tempo: Option<f64>,
    /// Time signature numerator.
    pub time_signature_numerator: Option<i64>,
    /// Time signature denominator (already decoded, e.g. 4 not 2).
    pub time_signature_denominator: Option<i64>,
    /// Number of tracks in the SMF.
    pub track_count: Option<i64>,
    /// Total NoteOn events with velocity > 0.
    pub note_count: Option<i64>,
    /// Number of distinct MIDI channels used.
    pub channel_count: Option<i64>,
    /// Best-guess key name, e.g. "C major".
    pub key_estimate: Option<String>,
}

/// Parse a MIDI file and return extracted metadata.
///
/// On any parse error the function returns an `Err`; the caller should log and
/// fall back to `None` for every field rather than aborting the scan.
pub fn parse_midi(path: &Path) -> Result<ParsedMidi, Box<dyn std::error::Error>> {
    let raw = std::fs::read(path)?;
    let smf = Smf::parse(&raw)?;

    // ── Ticks-per-quarter (Metrical only) ────────────────────────────────
    let tpq: u32 = match smf.header.timing {
        Timing::Metrical(t) => u16::from(t) as u32,
        Timing::Timecode(_, _) => {
            // SMPTE timing – duration calculation not supported; return partial.
            return Ok(ParsedMidi {
                track_count: Some(smf.tracks.len() as i64),
                ..Default::default()
            });
        }
    };

    let track_count = smf.tracks.len() as i64;

    // ── First pass: build tempo map & gather events ───────────────────────
    // tempo_map: Vec<(absolute_tick, microseconds_per_quarter)>
    let mut tempo_map: Vec<(u64, u32)> = Vec::new();
    let mut first_tempo_us: Option<u32> = None; // microseconds per quarter note
    let mut ts_num: Option<i64> = None;
    let mut ts_den: Option<i64> = None;
    let mut note_count: i64 = 0;
    let mut channels: HashSet<u8> = HashSet::new();

    // Pitch-class accumulator for key estimation (indexed 0=C … 11=B).
    let mut pitch_class_weights: [f64; 12] = [0.0; 12];

    // Track the maximum absolute tick seen across ALL tracks.
    let mut max_tick: u64 = 0;

    // Collect tempo events from all tracks in tick order.
    // SMF format-1 dedicates track 0 to tempo/meta, but other formats vary.
    for track in &smf.tracks {
        let mut abs_tick: u64 = 0;
        for event in track {
            abs_tick += u32::from(event.delta) as u64;
            match event.kind {
                TrackEventKind::Meta(MetaMessage::Tempo(t)) => {
                    let us = u32::from(t);
                    if first_tempo_us.is_none() {
                        first_tempo_us = Some(us);
                    }
                    tempo_map.push((abs_tick, us));
                }
                TrackEventKind::Meta(MetaMessage::TimeSignature(num, den_exp, _, _)) => {
                    if ts_num.is_none() {
                        ts_num = Some(num as i64);
                        // den_exp encodes the denominator as a negative power of 2
                        // (e.g. 2 → 4, 3 → 8).
                        ts_den = Some(1_i64 << den_exp as i64);
                    }
                }
                TrackEventKind::Midi { channel, message } => {
                    channels.insert(u8::from(channel));
                    match message {
                        MidiMessage::NoteOn { vel, key } => {
                            if u8::from(vel) > 0 {
                                note_count += 1;
                                let pc = u8::from(key) % 12;
                                pitch_class_weights[pc as usize] += u8::from(vel) as f64;
                            }
                        }
                        MidiMessage::NoteOff { key, .. } => {
                            // Count NoteOff only for pitch-class stats, not note_count.
                            let pc = u8::from(key) % 12;
                            pitch_class_weights[pc as usize] += 0.5;
                        }
                        _ => {}
                    }
                }
                _ => {}
            }
        }
        if abs_tick > max_tick {
            max_tick = abs_tick;
        }
    }

    // Sort tempo map by tick (multiple tracks may interleave).
    tempo_map.sort_by_key(|&(tick, _)| tick);

    // Default 120 BPM = 500 000 µs/quarter if no tempo event found.
    let default_us: u32 = 500_000;

    // ── Compute duration in seconds ───────────────────────────────────────
    let duration_secs: f64 = ticks_to_seconds(max_tick, tpq, &tempo_map, default_us);

    // ── BPM ───────────────────────────────────────────────────────────────
    let tempo_bpm: Option<f64> = first_tempo_us
        .or(if tempo_map.is_empty() {
            None
        } else {
            Some(default_us)
        })
        .map(|us| 60_000_000.0 / us as f64);

    // ── Key estimate ──────────────────────────────────────────────────────
    let key_estimate = estimate_key(&pitch_class_weights);

    Ok(ParsedMidi {
        duration: Some(duration_secs),
        tempo: tempo_bpm,
        time_signature_numerator: ts_num,
        time_signature_denominator: ts_den,
        track_count: Some(track_count),
        note_count: if note_count > 0 {
            Some(note_count)
        } else {
            None
        },
        channel_count: if !channels.is_empty() {
            Some(channels.len() as i64)
        } else {
            None
        },
        key_estimate,
    })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/// Convert an absolute tick position to seconds using a sorted tempo map.
fn ticks_to_seconds(target_tick: u64, tpq: u32, tempo_map: &[(u64, u32)], default_us: u32) -> f64 {
    if tpq == 0 {
        return 0.0;
    }
    let mut elapsed_us: f64 = 0.0;
    let mut prev_tick: u64 = 0;
    let mut current_us: u32 = default_us;

    for &(tempo_tick, new_us) in tempo_map {
        let end_tick = tempo_tick.min(target_tick);
        if end_tick > prev_tick {
            let delta = (end_tick - prev_tick) as f64;
            elapsed_us += delta / tpq as f64 * current_us as f64;
        }
        if tempo_tick >= target_tick {
            break;
        }
        current_us = new_us;
        prev_tick = tempo_tick;
    }

    // Remaining ticks after the last tempo event.
    if target_tick > prev_tick {
        let delta = (target_tick - prev_tick) as f64;
        elapsed_us += delta / tpq as f64 * current_us as f64;
    }

    elapsed_us / 1_000_000.0
}

/// Estimate the musical key from a 12-element pitch-class weight vector.
///
/// Uses the Krumhansl-Schmuckler key profiles to find the best-matching
/// major and minor key, then returns the one with the higher correlation.
fn estimate_key(weights: &[f64; 12]) -> Option<String> {
    let total: f64 = weights.iter().sum();
    if total <= 0.0 {
        return None;
    }

    // Krumhansl-Schmuckler major profile (C major starting position).
    #[rustfmt::skip]
    let major_profile: [f64; 12] = [
        6.35, 2.23, 3.48, 2.33, 4.38, 4.09,
        2.52, 5.19, 2.39, 3.66, 2.29, 2.88,
    ];
    // Krumhansl-Schmuckler minor profile.
    #[rustfmt::skip]
    let minor_profile: [f64; 12] = [
        6.33, 2.68, 3.52, 5.38, 2.60, 3.53,
        2.54, 4.75, 3.98, 2.69, 3.34, 3.17,
    ];

    const NOTE_NAMES: [&str; 12] = [
        "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
    ];

    let mut best_score = f64::NEG_INFINITY;
    let mut best_key = String::new();

    for root in 0..12usize {
        // Rotate profiles to test each root.
        let major_corr = pearson_correlation(weights, &rotate(&major_profile, root));
        let minor_corr = pearson_correlation(weights, &rotate(&minor_profile, root));

        if major_corr > best_score {
            best_score = major_corr;
            best_key = format!("{} major", NOTE_NAMES[root]);
        }
        if minor_corr > best_score {
            best_score = minor_corr;
            best_key = format!("{} minor", NOTE_NAMES[root]);
        }
    }

    if best_key.is_empty() {
        None
    } else {
        Some(best_key)
    }
}

fn rotate(arr: &[f64; 12], n: usize) -> [f64; 12] {
    let mut out = [0.0f64; 12];
    for i in 0..12 {
        out[i] = arr[(i + 12 - n) % 12];
    }
    out
}

fn pearson_correlation(a: &[f64; 12], b: &[f64; 12]) -> f64 {
    let n = 12.0_f64;
    let mean_a = a.iter().sum::<f64>() / n;
    let mean_b = b.iter().sum::<f64>() / n;
    let mut num = 0.0_f64;
    let mut den_a = 0.0_f64;
    let mut den_b = 0.0_f64;
    for i in 0..12 {
        let da = a[i] - mean_a;
        let db = b[i] - mean_b;
        num += da * db;
        den_a += da * da;
        den_b += db * db;
    }
    let denom = (den_a * den_b).sqrt();
    if denom < f64::EPSILON {
        0.0
    } else {
        num / denom
    }
}
