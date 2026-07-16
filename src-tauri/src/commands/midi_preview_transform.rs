use std::io::Write as _;
use std::sync::{Arc, Mutex};

use super::CommandError;

pub(crate) const MAX_MIDI_PREVIEW_BYTES: u64 = 10 * 1024 * 1024;

pub(crate) fn cleanup_temp_midi_preview(temp_file: &Arc<Mutex<Option<tempfile::NamedTempFile>>>) {
    let _ = temp_file.lock().unwrap().take();
}

fn target_bpm_to_tempo_us(target_bpm: f64) -> Option<u32> {
    if !target_bpm.is_finite() || target_bpm <= 0.0 {
        return None;
    }
    Some((60_000_000.0 / target_bpm).round().clamp(1.0, 16_777_215.0) as u32)
}

fn transpose_note_key(key: midly::num::u7, semitones: i8) -> midly::num::u7 {
    let shifted = i16::from(key.as_int()) + i16::from(semitones);
    midly::num::u7::from(shifted.clamp(0, 127) as u8)
}

fn transform_midi_preview_bytes(
    bytes: &[u8],
    target_bpm: Option<f64>,
    transpose_semitones: Option<i8>,
) -> Result<Vec<u8>, CommandError> {
    let mut smf = midly::Smf::parse(bytes).map_err(|error| CommandError {
        code: "midi_parse_error".to_string(),
        message: format!("Failed to parse MIDI for preview sync: {error}"),
        details: None,
    })?;
    let target_tempo = target_bpm.and_then(target_bpm_to_tempo_us);
    for track in &mut smf.tracks {
        for event in track {
            match &mut event.kind {
                midly::TrackEventKind::Meta(midly::MetaMessage::Tempo(tempo)) => {
                    if let Some(target_tempo) = target_tempo {
                        *tempo = target_tempo.into();
                    }
                }
                midly::TrackEventKind::Midi { channel, message } => {
                    if channel.as_int() == 9 {
                        continue;
                    }
                    if let Some(semitones) = transpose_semitones {
                        match message {
                            midly::MidiMessage::NoteOn { key, .. }
                            | midly::MidiMessage::NoteOff { key, .. } => {
                                *key = transpose_note_key(*key, semitones);
                            }
                            _ => {}
                        }
                    }
                }
                _ => {}
            }
        }
    }
    let mut transformed = Vec::new();
    smf.write_std(&mut transformed)
        .map_err(|error| CommandError {
            code: "midi_write_error".to_string(),
            message: format!("Failed to write preview MIDI: {error}"),
            details: None,
        })?;
    Ok(transformed)
}

pub(crate) fn create_preview_midi_file(
    path: &str,
    target_bpm: Option<f64>,
    transpose_semitones: Option<i8>,
) -> Result<tempfile::NamedTempFile, CommandError> {
    let metadata = std::fs::metadata(path).map_err(|error| CommandError {
        code: "midi_metadata_error".to_string(),
        message: format!("Failed to inspect MIDI file: {error}"),
        details: Some(path.to_string()),
    })?;
    if metadata.len() > MAX_MIDI_PREVIEW_BYTES {
        return Err(CommandError {
            code: "midi_preview_too_large".to_string(),
            message: "MIDI file is too large for synced preview".to_string(),
            details: Some(format!("{} bytes", metadata.len())),
        });
    }
    let bytes = std::fs::read(path).map_err(|error| CommandError {
        code: "midi_read_error".to_string(),
        message: format!("Failed to read MIDI file: {error}"),
        details: Some(path.to_string()),
    })?;
    let transformed = transform_midi_preview_bytes(&bytes, target_bpm, transpose_semitones)?;
    let mut temp_file = tempfile::Builder::new()
        .prefix("osm-preview-")
        .suffix(".mid")
        .tempfile()
        .map_err(|error| CommandError {
            code: "midi_temp_create_error".to_string(),
            message: format!("Failed to create temporary preview MIDI: {error}"),
            details: None,
        })?;
    temp_file
        .write_all(&transformed)
        .map_err(|error| CommandError {
            code: "midi_temp_write_error".to_string(),
            message: format!("Failed to write temporary preview MIDI: {error}"),
            details: Some(temp_file.path().to_string_lossy().to_string()),
        })?;
    Ok(temp_file)
}

#[cfg(test)]
mod tests {
    use super::{
        create_preview_midi_file, target_bpm_to_tempo_us, transform_midi_preview_bytes,
        transpose_note_key, MAX_MIDI_PREVIEW_BYTES,
    };

    #[test]
    fn target_bpm_maps_to_midi_tempo_microseconds() {
        assert_eq!(target_bpm_to_tempo_us(120.0), Some(500_000));
        assert_eq!(target_bpm_to_tempo_us(150.0), Some(400_000));
        assert_eq!(target_bpm_to_tempo_us(0.0), None);
    }

    #[test]
    fn transpose_note_clamps_to_midi_note_range() {
        assert_eq!(transpose_note_key(60.into(), 2).as_int(), 62);
        assert_eq!(transpose_note_key(1.into(), -4).as_int(), 0);
        assert_eq!(transpose_note_key(126.into(), 4).as_int(), 127);
    }

    #[test]
    fn transform_midi_rewrites_tempo_and_transposes_non_percussion_notes() {
        let smf = midly::Smf {
            header: midly::Header::new(
                midly::Format::SingleTrack,
                midly::Timing::Metrical(480.into()),
            ),
            tracks: vec![vec![
                midly::TrackEvent {
                    delta: 0.into(),
                    kind: midly::TrackEventKind::Meta(midly::MetaMessage::Tempo(500_000.into())),
                },
                midly::TrackEvent {
                    delta: 0.into(),
                    kind: midly::TrackEventKind::Midi {
                        channel: 0.into(),
                        message: midly::MidiMessage::NoteOn {
                            key: 60.into(),
                            vel: 100.into(),
                        },
                    },
                },
                midly::TrackEvent {
                    delta: 0.into(),
                    kind: midly::TrackEventKind::Midi {
                        channel: 9.into(),
                        message: midly::MidiMessage::NoteOn {
                            key: 36.into(),
                            vel: 100.into(),
                        },
                    },
                },
                midly::TrackEvent {
                    delta: 0.into(),
                    kind: midly::TrackEventKind::Meta(midly::MetaMessage::EndOfTrack),
                },
            ]],
        };
        let mut bytes = Vec::new();
        smf.write_std(&mut bytes).unwrap();
        let transformed = transform_midi_preview_bytes(&bytes, Some(150.0), Some(2)).unwrap();
        let parsed = midly::Smf::parse(&transformed).unwrap();
        match parsed.tracks[0][0].kind {
            midly::TrackEventKind::Meta(midly::MetaMessage::Tempo(tempo)) => {
                assert_eq!(tempo.as_int(), 400_000)
            }
            _ => panic!("expected tempo event"),
        }
        match parsed.tracks[0][1].kind {
            midly::TrackEventKind::Midi {
                message: midly::MidiMessage::NoteOn { key, .. },
                ..
            } => assert_eq!(key.as_int(), 62),
            _ => panic!("expected note event"),
        }
        match parsed.tracks[0][2].kind {
            midly::TrackEventKind::Midi {
                message: midly::MidiMessage::NoteOn { key, .. },
                ..
            } => assert_eq!(key.as_int(), 36),
            _ => panic!("expected percussion event"),
        }
    }

    #[test]
    fn preview_file_rejects_oversized_midi_before_reading() {
        let input = tempfile::NamedTempFile::new().unwrap();
        input.as_file().set_len(MAX_MIDI_PREVIEW_BYTES + 1).unwrap();
        let error = create_preview_midi_file(input.path().to_str().unwrap(), Some(120.0), None)
            .expect_err("oversized MIDI should be rejected");
        assert_eq!(error.code, "midi_preview_too_large");
    }
}
