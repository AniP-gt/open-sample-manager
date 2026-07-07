use rusqlite::Connection;

use crate::db::operations::SampleInput;
use crate::db::schema::init_database;

mod crud;
mod embedding;
mod lifecycle;
mod queries;
mod search;

pub(super) fn setup_db() -> Connection {
    let conn = Connection::open_in_memory().expect("failed to create in-memory DB");
    init_database(&conn).expect("failed to initialize schema");
    conn
}

pub(super) fn make_input(path: &str, file_name: &str) -> SampleInput {
    SampleInput {
        path: path.to_string(),
        file_name: file_name.to_string(),
        duration: Some(2.5),
        bpm: Some(120.0),
        periodicity: Some(0.85),
        sample_rate: Some(44100),
        file_size: None,
        artist: None,
        low_ratio: Some(0.65),
        attack_slope: Some(30.0),
        decay_time: Some(150.0),
        sample_type: Some("oneshot".to_string()),
        waveform_peaks: None,
        embedding: None,
        source: None,
        pack_name: None,
        license: None,
        license_url: None,
        license_memo: None,
        imported_at: None,
        peak_db: None,
        rms_db: None,
        leading_silence_ms: None,
        clipping_count: None,
        channel_count: None,
        bit_depth: None,
        quality_flags: None,
        playback_type: None,
        instrument_type: None,
        musical_key: None,
        content_hash: None,
    }
}
