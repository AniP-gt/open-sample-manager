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
}
