use tempfile::TempDir;

#[test]
fn parse_midi_extracts_metadata_from_minimal_smf() {
    #[rustfmt::skip]
    let smf_bytes: &[u8] = &[
        b'M', b'T', b'h', b'd',
        0x00, 0x00, 0x00, 0x06,
        0x00, 0x00,
        0x00, 0x01,
        0x01, 0xE0,
        b'M', b'T', b'r', b'k',
        0x00, 0x00, 0x00, 0x25,
        0x00, 0xFF, 0x51, 0x03, 0x07, 0xA1, 0x20,
        0x00, 0xFF, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08,
        0x00, 0x90, 0x3C, 0x40,
        0x83, 0x60, 0x80, 0x3C, 0x00,
        0x00, 0x90, 0x40, 0x40,
        0x83, 0x60, 0x80, 0x40, 0x00,
        0x00, 0xFF, 0x2F, 0x00,
    ];

    let dir = TempDir::new().expect("temp dir");
    let midi_path = dir.path().join("test.mid");
    std::fs::write(&midi_path, smf_bytes).expect("write test midi");

    let result = open_sample_manager_core::analysis::midi::parse_midi(&midi_path)
        .expect("parse_midi should succeed on valid SMF");

    let duration = result.duration.expect("duration should be Some");
    assert!(
        (duration - 1.0).abs() < 0.05,
        "expected ~1.0s duration, got {duration}"
    );

    let tempo = result.tempo.expect("tempo should be Some");
    assert!(
        (tempo - 120.0).abs() < 0.5,
        "expected ~120 BPM, got {tempo}"
    );

    assert_eq!(result.time_signature_numerator, Some(4));
    assert_eq!(result.time_signature_denominator, Some(4));
    assert_eq!(result.track_count, Some(1));
    assert_eq!(result.note_count, Some(2), "2 NoteOn events with vel>0");
    assert_eq!(result.channel_count, Some(1));
    assert!(
        result.key_estimate.is_some(),
        "key estimate should be populated"
    );
    assert_eq!(result.musical_role.as_deref(), Some("melody"));
    assert_eq!(result.polyphony.as_deref(), Some("monophonic"));
    assert_eq!(result.density.as_deref(), Some("medium"));
    assert_eq!(result.register.as_deref(), Some("mid"));
    assert_eq!(result.bar_count, Some(0.5));
    assert_eq!(result.suggested_instrument, None);
}

#[test]
fn parse_midi_classifies_chord_phrase_and_general_midi_program() {
    #[rustfmt::skip]
    let smf_bytes: &[u8] = &[
        b'M', b'T', b'h', b'd',
        0x00, 0x00, 0x00, 0x06,
        0x00, 0x00,
        0x00, 0x01,
        0x01, 0xE0,
        b'M', b'T', b'r', b'k',
        0x00, 0x00, 0x00, 0x23,
        0x00, 0xFF, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08,
        0x00, 0xC0, 0x00,
        0x00, 0x90, 0x3C, 0x40,
        0x00, 0x90, 0x40, 0x40,
        0x00, 0x90, 0x43, 0x40,
        0x8F, 0x00, 0x80, 0x3C, 0x00,
        0x00, 0x80, 0x40, 0x00,
        0x00, 0x80, 0x43, 0x00,
        0x00, 0xFF, 0x2F, 0x00,
    ];

    let dir = TempDir::new().expect("temp dir");
    let midi_path = dir.path().join("chord.mid");
    std::fs::write(&midi_path, smf_bytes).expect("write test midi");

    let result = open_sample_manager_core::analysis::midi::parse_midi(&midi_path)
        .expect("parse_midi should succeed on valid SMF");

    assert_eq!(result.musical_role.as_deref(), Some("chords"));
    assert_eq!(result.polyphony.as_deref(), Some("polyphonic"));
    assert_eq!(result.density.as_deref(), Some("sparse"));
    assert_eq!(result.register.as_deref(), Some("mid"));
    assert_eq!(result.bar_count, Some(1.0));
    assert_eq!(result.suggested_instrument.as_deref(), Some("piano"));
}

#[test]
fn parse_midi_classifies_general_midi_percussion_channel() {
    #[rustfmt::skip]
    let smf_bytes: &[u8] = &[
        b'M', b'T', b'h', b'd',
        0x00, 0x00, 0x00, 0x06,
        0x00, 0x00,
        0x00, 0x01,
        0x01, 0xE0,
        b'M', b'T', b'r', b'k',
        0x00, 0x00, 0x00, 0x15,
        0x00, 0xFF, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08,
        0x00, 0x99, 0x24, 0x64,
        0x83, 0x60, 0x89, 0x24, 0x00,
        0x00, 0xFF, 0x2F, 0x00,
    ];

    let dir = TempDir::new().expect("temp dir");
    let midi_path = dir.path().join("drums.mid");
    std::fs::write(&midi_path, smf_bytes).expect("write test midi");

    let result = open_sample_manager_core::analysis::midi::parse_midi(&midi_path)
        .expect("parse_midi should succeed on valid SMF");

    assert_eq!(result.musical_role.as_deref(), Some("drums"));
    assert_eq!(result.polyphony.as_deref(), Some("monophonic"));
    assert_eq!(result.register, None);
    assert_eq!(result.bar_count, Some(0.25));
    assert_eq!(result.suggested_instrument.as_deref(), Some("drums"));
}
