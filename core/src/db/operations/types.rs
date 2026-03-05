use serde::Serialize;

/// A row from the `samples` table.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct SampleRow {
    /// Primary key (auto-generated on insert).
    pub id: i64,
    /// Absolute file path (unique).
    pub path: String,
    /// File name component (e.g. "`kick_808.wav`").
    pub file_name: String,
    /// Duration in seconds.
    pub duration: Option<f64>,
    /// Estimated BPM.
    pub bpm: Option<f64>,
    /// Periodicity strength (0.0–1.0).
    pub periodicity: Option<f64>,
    /// Sample rate in Hz.
    pub sample_rate: Option<i64>,
    /// File size in bytes.
    pub file_size: Option<i64>,
    /// Embedded artist metadata (if available).
    pub artist: Option<String>,
    /// Low-band energy ratio.
    pub low_ratio: Option<f64>,
    /// Attack slope in dB/ms.
    pub attack_slope: Option<f64>,
    /// Decay time in ms.
    pub decay_time: Option<f64>,
    /// Classification label ("loop" or "oneshot").
    pub sample_type: Option<String>,
    /// Waveform peaks as JSON array of floats.
    pub waveform_peaks: Option<String>,
    /// Feature embedding blob.
    pub embedding: Option<Vec<u8>>,
    /// Whether the file is currently accessible.
    pub is_online: bool,
    /// Playback type: "loop" or "oneshot".
    pub playback_type: String,
    /// Instrument type: "kick", "snare", "hihat", "bass", "synth", "fx", "vocal", "percussion", "other".
    pub instrument_type: String,
}

/// Result of an embedding search: similarity score + sample row.
#[derive(Debug, Clone, Serialize)]
pub struct EmbeddingSearchResult {
    pub similarity: f32,
    pub row: SampleRow,
}

/// Parameters for inserting or updating a sample (no `id` field).
#[derive(Debug, Clone)]
pub struct SampleInput {
    /// Absolute file path (unique key).
    pub path: String,
    /// File name component.
    pub file_name: String,
    /// Duration in seconds.
    pub duration: Option<f64>,
    /// Estimated BPM.
    pub bpm: Option<f64>,
    /// Periodicity strength.
    pub periodicity: Option<f64>,
    /// Sample rate in Hz.
    pub sample_rate: Option<i64>,
    /// File size in bytes.
    pub file_size: Option<i64>,
    /// Artist metadata if available.
    pub artist: Option<String>,
    /// Low-band energy ratio.
    pub low_ratio: Option<f64>,
    /// Classification label.
    pub sample_type: Option<String>,
    /// Waveform peaks as JSON array of floats.
    pub waveform_peaks: Option<String>,
    /// Attack slope in dB/ms.
    pub attack_slope: Option<f64>,
    /// Decay time in ms.
    pub decay_time: Option<f64>,
    /// Feature embedding blob.
    pub embedding: Option<Vec<u8>>,
    /// Playback type: "loop" or "oneshot".
    pub playback_type: Option<String>,
    /// Instrument type: "kick", "snare", etc.
    pub instrument_type: Option<String>,
}

/// A row from the `midis` table.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct MidiRow {
    pub id: i64,
    pub path: String,
    pub file_name: String,
    pub duration: Option<f64>,
    pub tempo: Option<f64>,
    pub time_signature_numerator: i64,
    pub time_signature_denominator: i64,
    pub track_count: Option<i64>,
    pub note_count: Option<i64>,
    pub channel_count: Option<i64>,
    pub key_estimate: Option<String>,
    pub file_size: Option<i64>,
    pub created_at: String,
    pub modified_at: String,
    /// Tag name assigned via midi_file_tags; empty string if none.
    pub tag_name: String,
}

/// Parameters for inserting or updating a MIDI file.
#[derive(Debug, Clone)]
pub struct MidiInput {
    pub path: String,
    pub file_name: String,
    pub duration: Option<f64>,
    pub tempo: Option<f64>,
    pub time_signature_numerator: Option<i64>,
    pub time_signature_denominator: Option<i64>,
    pub track_count: Option<i64>,
    pub note_count: Option<i64>,
    pub channel_count: Option<i64>,
    pub key_estimate: Option<String>,
    pub file_size: Option<i64>,
}

/// A row from the `instrument_types` table.
#[derive(Debug, Clone, Serialize)]
pub struct InstrumentTypeRow {
    pub id: i64,
    pub name: String,
    pub created_at: String,
}

/// A row from the `midi_tags` table.
#[derive(Debug, Clone, Serialize)]
pub struct MidiTagRow {
    pub id: i64,
    pub name: String,
    pub created_at: String,
}
