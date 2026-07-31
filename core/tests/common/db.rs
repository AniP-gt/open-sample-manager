use open_sample_manager_core::db::operations::MidiInput;
use open_sample_manager_core::db::schema::init_database;
use rusqlite::Connection;

pub fn init_test_db() -> Connection {
    let conn = Connection::open_in_memory().expect("open in-memory DB");
    init_database(&conn).expect("init schema");
    conn
}

pub fn midi_input(path: &str, file_name: &str) -> MidiInput {
    MidiInput {
        path: path.to_string(),
        file_name: file_name.to_string(),
        duration: None,
        tempo: None,
        time_signature_numerator: None,
        time_signature_denominator: None,
        track_count: None,
        note_count: None,
        channel_count: None,
        key_estimate: None,
        musical_role: None,
        polyphony: None,
        density: None,
        register: None,
        bar_count: None,
        suggested_instrument: None,
        file_size: None,
    }
}
