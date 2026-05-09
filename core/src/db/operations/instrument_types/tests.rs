use rusqlite::Connection;

use crate::db::schema::init_database;

use super::{
    delete_instrument_type, get_all_instrument_types, insert_instrument_type,
    update_instrument_type,
};

fn setup_db() -> Connection {
    let conn = Connection::open_in_memory().expect("failed to create in-memory DB");
    init_database(&conn).expect("failed to initialize schema");
    conn
}

#[test]
fn insert_update_delete_instrument_type_roundtrip() {
    let conn = setup_db();

    let id = insert_instrument_type(&conn, "phase1-pad").expect("insert failed");
    let inserted = get_all_instrument_types(&conn).expect("list failed");
    assert!(inserted
        .iter()
        .any(|row| row.id == id && row.name == "phase1-pad"));

    assert_eq!(
        update_instrument_type(&conn, id, "phase1-pluck").expect("update failed"),
        1
    );
    let updated = get_all_instrument_types(&conn).expect("list after update failed");
    assert!(updated
        .iter()
        .any(|row| row.id == id && row.name == "phase1-pluck"));
    assert!(!updated.iter().any(|row| row.name == "phase1-pad"));

    assert_eq!(delete_instrument_type(&conn, id).expect("delete failed"), 1);
    let remaining = get_all_instrument_types(&conn).expect("list after delete failed");
    assert!(!remaining.iter().any(|row| row.id == id));
}

#[test]
fn duplicate_instrument_type_name_fails() {
    let conn = setup_db();

    insert_instrument_type(&conn, "phase1-duplicate").expect("first insert failed");
    assert!(
        insert_instrument_type(&conn, "phase1-duplicate").is_err(),
        "instrument type names are unique"
    );
}

#[test]
fn updating_missing_instrument_type_returns_zero() {
    let conn = setup_db();

    assert_eq!(
        update_instrument_type(&conn, -1, "phase1-missing").expect("update failed"),
        0
    );
}

#[test]
fn deleting_missing_instrument_type_returns_zero() {
    let conn = setup_db();

    assert_eq!(delete_instrument_type(&conn, -1).expect("delete failed"), 0);
}
