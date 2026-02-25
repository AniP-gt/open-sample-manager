use rusqlite::Connection;
use tempfile::TempDir;

use open_sample_manager_core::db::operations::{get_sample_by_id, insert_sample, SampleInput};
use open_sample_manager_core::db::schema::init_database;
use open_sample_manager_core::SampleManager;

#[test]
fn update_classification_by_id_updates_row() {
    // Create a temporary file-backed DB so both the test inserter and SampleManager
    // share the same underlying SQLite file.
    let dir = TempDir::new().expect("tempdir");
    let db_path = dir.path().join("test_update.db");

    // Prepare a connection and initialize schema, then insert a sample
    {
        let conn = Connection::open(&db_path).expect("open db");
        init_database(&conn).expect("init schema");

        let input = SampleInput {
            path: "/samples/test.wav".to_string(),
            file_name: "test.wav".to_string(),
            duration: Some(1.0),
            bpm: None,
            periodicity: None,
            sample_rate: None,
            file_size: None,
            artist: None,
            low_ratio: None,
            attack_slope: None,
            decay_time: None,
            sample_type: Some("oneshot".to_string()),
            waveform_peaks: None,
            embedding: None,
            playback_type: Some("oneshot".to_string()),
            instrument_type: Some("other".to_string()),
        };

        let id = insert_sample(&conn, &input).expect("insert");

        // Ensure the inserted row has expected defaults
        let row = get_sample_by_id(&conn, id).expect("query").expect("row");
        assert_eq!(row.playback_type, "oneshot");
        assert_eq!(row.instrument_type, "other");
    }

    // Create a SampleManager that opens the same DB file
    let manager = SampleManager::new(Some(db_path.to_str().unwrap())).expect("manager");

    // Query the id of the inserted row using a fresh connection
    let conn2 = Connection::open(&db_path).expect("open2");
    let row = conn2
        .query_row(
            "SELECT id FROM samples WHERE path = ?1",
            [&"/samples/test.wav"],
            |r| r.get(0),
        )
        .expect("get id");

    // Perform the update by id
    let updated = manager
        .update_sample_classification(
            Some(row),
            None,
            Some("loop".to_string()),
            Some("synth".to_string()),
        )
        .expect("update");
    assert_eq!(updated, 1);

    // Verify persisted values
    let conn3 = Connection::open(&db_path).expect("open3");
    let updated_row = get_sample_by_id(&conn3, row).expect("query").expect("row");
    assert_eq!(updated_row.playback_type, "loop");
    assert_eq!(updated_row.instrument_type, "synth");
}
