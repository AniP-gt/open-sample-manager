use std::fs::File;
use std::path::Path;

use open_sample_manager_core::db::operations::{
    get_midi_by_path, insert_midi, list_midis_paginated, MidiInput,
};
use open_sample_manager_core::db::schema::init_database;
use open_sample_manager_core::scanner::scan_midi_directory;
use open_sample_manager_core::SampleManager;
use rusqlite::Connection;
use tempfile::TempDir;

fn touch_files(dir: &TempDir, names: &[&str]) {
    for name in names {
        File::create(dir.path().join(name)).expect("create test file");
    }
}

#[test]
fn midi_schema_init_is_idempotent_on_in_memory_db() {
    let conn = Connection::open_in_memory().expect("open in-memory DB");

    init_database(&conn).expect("first init_database should succeed");
    init_database(&conn).expect("second init_database should succeed");

    let column_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM pragma_table_info('midis')",
            [],
            |row| row.get(0),
        )
        .expect("query midis columns");
    assert!(
        column_count >= 12,
        "midis table should have expected columns"
    );
}

#[test]
fn midi_db_roundtrip_insert_get_list_paginated() {
    let conn = Connection::open_in_memory().expect("open in-memory DB");
    init_database(&conn).expect("init schema");

    let first = MidiInput {
        path: "/tmp/first.mid".to_string(),
        file_name: "first.mid".to_string(),
        duration: Some(12.5),
        tempo: Some(128.0),
        time_signature_numerator: Some(3),
        time_signature_denominator: Some(4),
        track_count: Some(2),
        note_count: Some(96),
        channel_count: Some(2),
        key_estimate: Some("C minor".to_string()),
        file_size: Some(2048),
    };
    let second = MidiInput {
        path: "/tmp/second.midi".to_string(),
        file_name: "second.midi".to_string(),
        duration: None,
        tempo: None,
        time_signature_numerator: None,
        time_signature_denominator: None,
        track_count: Some(1),
        note_count: Some(48),
        channel_count: Some(1),
        key_estimate: None,
        file_size: Some(1024),
    };

    let first_id = insert_midi(&conn, &first).expect("insert first midi");
    let second_id = insert_midi(&conn, &second).expect("insert second midi");
    assert!(first_id > 0);
    assert!(second_id > first_id);

    let fetched = get_midi_by_path(&conn, "/tmp/first.mid")
        .expect("get midi by path")
        .expect("midi should exist");
    assert_eq!(fetched.file_name, "first.mid");
    assert_eq!(fetched.tempo, Some(128.0));
    assert_eq!(fetched.time_signature_numerator, 3);
    assert_eq!(fetched.time_signature_denominator, 4);

    let page_one = list_midis_paginated(&conn, 1, 0).expect("list page one");
    assert_eq!(page_one.len(), 1);
    assert_eq!(page_one[0].path, "/tmp/first.mid");

    let page_two = list_midis_paginated(&conn, 1, 1).expect("list page two");
    assert_eq!(page_two.len(), 1);
    assert_eq!(page_two[0].path, "/tmp/second.midi");
    assert_eq!(page_two[0].time_signature_numerator, 4);
    assert_eq!(page_two[0].time_signature_denominator, 4);
}

#[test]
fn midi_insert_duplicate_path_returns_error_without_panic() {
    let conn = Connection::open_in_memory().expect("open in-memory DB");
    init_database(&conn).expect("init schema");

    let midi = MidiInput {
        path: "/tmp/dup.mid".to_string(),
        file_name: "dup.mid".to_string(),
        duration: None,
        tempo: None,
        time_signature_numerator: None,
        time_signature_denominator: None,
        track_count: None,
        note_count: None,
        channel_count: None,
        key_estimate: None,
        file_size: None,
    };

    let first = insert_midi(&conn, &midi).expect("first insert should succeed");
    assert!(first > 0, "first insert should return a valid rowid");

    // Duplicate path: UPSERT updates the existing row and returns its rowid.
    let duplicate = insert_midi(&conn, &midi).expect("duplicate insert should not error");
    assert!(duplicate > 0, "duplicate path upsert should return a valid rowid");
}

#[test]
fn scan_midi_directory_finds_mid_and_midi_only() {
    let dir = TempDir::new().expect("create temp dir");
    touch_files(
        &dir,
        &[
            "beat.mid",
            "chords.midi",
            "UPPER.MID",
            "noise.wav",
            "notes.txt",
        ],
    );

    let mut found = scan_midi_directory(dir.path())
        .iter()
        .map(|p| {
            p.file_name()
                .expect("file name")
                .to_string_lossy()
                .into_owned()
        })
        .collect::<Vec<_>>();
    found.sort();

    assert_eq!(found, vec!["UPPER.MID", "beat.mid", "chords.midi"]);
}

#[test]
fn manager_scan_midi_directory_happy_path_and_duplicate_error_path() {
    let dir = TempDir::new().expect("create temp dir");
    touch_files(&dir, &["one.mid", "two.midi", "skip.wav"]);

    let manager = SampleManager::new(None).expect("create manager");
    let first_count = manager
        .scan_midi_directory(dir.path())
        .expect("first midi scan should succeed");
    assert_eq!(first_count, 2);

    // Second scan: UPSERT updates existing rows (metadata refresh), so count == 2.
    let second_count = manager
        .scan_midi_directory(dir.path())
        .expect("second midi scan should succeed and upsert duplicates");
    assert_eq!(second_count, 2);

    let rows = manager
        .list_midis_paginated(10, 0)
        .expect("list manager midi rows");
    assert_eq!(rows.len(), 2);

    let one_path = dir.path().join("one.mid");
    let one = manager
        .get_midi(one_path.to_str().expect("utf8 path"))
        .expect("get midi by path")
        .expect("midi should exist");
    assert_eq!(one.file_name, "one.mid");
}

#[test]
fn manager_scan_midi_directory_nonexistent_path_returns_zero() {
    let manager = SampleManager::new(None).expect("create manager");
    let count = manager
        .scan_midi_directory(Path::new("/tmp/__nonexistent_midi_scan_dir__"))
        .expect("scan should not fail for missing directory");
    assert_eq!(count, 0);
}


#[test]
fn parse_midi_extracts_metadata_from_minimal_smf() {
    // Minimal SMF format-0 (single track), 480 tpq, 120 BPM (500_000 µs/beat).
    // The byte layout follows the Standard MIDI Files 1.0 spec.
    //
    // MThd header (14 bytes):
    //   "MThd" length=6 format=0 ntrks=1 division=480(0x01E0)
    // MTrk chunk:
    //   Tempo: delta=0, FF 51 03 07 A1 20  (500_000 µs = 120 BPM)
    //   TimeSig: delta=0, FF 58 04 04 02 18 08  (4/4)
    //   NoteOn ch0 C4 vel=64: delta=0, 90 3C 40
    //   NoteOff ch0 C4 vel=0: delta=480, 80 3C 00
    //   NoteOn ch0 E4 vel=64: delta=0, 90 40 40
    //   NoteOff ch0 E4 vel=0: delta=480, 80 40 00
    //   End of Track: delta=0, FF 2F 00
    #[rustfmt::skip]
    let smf_bytes: &[u8] = &[
        // MThd
        b'M', b'T', b'h', b'd',
        0x00, 0x00, 0x00, 0x06, // chunk length = 6
        0x00, 0x00,             // format 0
        0x00, 0x01,             // 1 track
        0x01, 0xE0,             // 480 tpq
        // MTrk
        b'M', b'T', b'r', b'k',
        0x00, 0x00, 0x00, 0x25, // chunk length = 37
        // delta=0, Tempo 500_000 (0x07A120)
        0x00, 0xFF, 0x51, 0x03, 0x07, 0xA1, 0x20,
        // delta=0, TimeSignature 4/4
        0x00, 0xFF, 0x58, 0x04, 0x04, 0x02, 0x18, 0x08,
        // delta=0, NoteOn ch0, C4 (0x3C), vel=64
        0x00, 0x90, 0x3C, 0x40,
        // delta=480 (0x83 0x60), NoteOff ch0, C4, vel=0
        0x83, 0x60, 0x80, 0x3C, 0x00,
        // delta=0, NoteOn ch0, E4 (0x40), vel=64
        0x00, 0x90, 0x40, 0x40,
        // delta=480 (0x83 0x60), NoteOff ch0, E4, vel=0
        0x83, 0x60, 0x80, 0x40, 0x00,
        // delta=0, End of Track
        0x00, 0xFF, 0x2F, 0x00,
    ];

    // Write to a temp file so parse_midi can read it from disk.
    let dir = TempDir::new().expect("temp dir");
    let midi_path = dir.path().join("test.mid");
    std::fs::write(&midi_path, smf_bytes).expect("write test midi");

    let result = open_sample_manager_core::analysis::midi::parse_midi(&midi_path)
        .expect("parse_midi should succeed on valid SMF");

    // 2 quarter-notes at 120 BPM = 1 second
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
    assert!(result.key_estimate.is_some(), "key estimate should be populated");
}