use rusqlite::{params, Connection};

use crate::db::schema::init_database;

fn setup_db() -> Connection {
    let conn = Connection::open_in_memory().expect("open in-memory db");
    conn.execute_batch("PRAGMA foreign_keys = ON")
        .expect("enable foreign keys");
    init_database(&conn).expect("initialize db");
    conn
}

#[test]
fn collection_operations_roundtrip() {
    let mut conn = setup_db();

    for (path, file_name) in [
        ("/tmp/one.wav", "one.wav"),
        ("/tmp/two.wav", "two.wav"),
        ("/tmp/three.wav", "three.wav"),
    ] {
        conn.execute(
            "INSERT INTO samples (path, file_name) VALUES (?1, ?2)",
            params![path, file_name],
        )
        .expect("insert sample");
    }

    let member_sample_ids = [3_i64, 1, 2];
    let add_result =
        super::add_samples_to_collection(&mut conn, "  Drum   Kit ", &member_sample_ids)
            .expect("create collection and add samples");
    let collection_id = add_result.collection_id;
    assert!(add_result.created);
    assert_eq!(add_result.added_count, 3);
    let collection = super::get_collection_by_id(&conn, collection_id)
        .expect("get collection by id")
        .expect("collection should exist");
    assert_eq!(collection.name, "drum kit");

    let members =
        super::list_collection_member_sample_ids(&conn, collection_id).expect("member ids");
    assert_eq!(members, member_sample_ids.to_vec());

    let detailed = super::get_collection_members(&conn, collection_id).expect("get member rows");
    assert_eq!(detailed.len(), member_sample_ids.len());
    assert_eq!(detailed[0].file_name, "three.wav");
    assert_eq!(detailed[1].file_name, "one.wav");
    assert_eq!(detailed[2].file_name, "two.wav");

    let positioned =
        super::list_collection_members_with_positions(&conn, collection_id).expect("get positions");
    assert_eq!(positioned[0].position, 1);
    assert_eq!(positioned[1].position, 2);
    assert_eq!(positioned[2].position, 3);
    assert_eq!(positioned[0].sample_id, 3);
    assert_eq!(positioned[1].sample_id, 1);
    assert_eq!(positioned[2].sample_id, 2);

    let duplicate = super::add_samples_to_collection(&mut conn, "drum kit", &[1, 1])
        .expect("add duplicate sample");
    assert!(!duplicate.created);
    assert_eq!(duplicate.added_count, 0);

    conn.execute("DELETE FROM samples WHERE id = ?1", [1_i64])
        .expect("delete sample with cascading collection cleanup");
    let after_cascade = super::list_collection_member_sample_ids(&conn, collection_id)
        .expect("list members after sample deletion");
    assert_eq!(after_cascade, vec![3, 2]);
}

#[test]
fn add_samples_to_collection_rejects_empty_batch() {
    let mut conn = setup_db();

    let err = super::add_samples_to_collection(&mut conn, "drum", &[])
        .expect_err("empty sample list should fail");
    assert!(matches!(err, rusqlite::Error::InvalidParameterCount(1, 0)));
}

#[test]
fn add_samples_to_collection_limits_batch_to_one_hundred_sample_ids() {
    let mut conn = setup_db();
    let sample_ids: Vec<i64> = (1_i64..=101).collect();

    let err = super::add_samples_to_collection(&mut conn, "drum", &sample_ids)
        .expect_err("too many sample ids should fail");
    assert!(matches!(
        err,
        rusqlite::Error::InvalidParameterCount(100, 101)
    ));
}

#[test]
fn add_samples_to_collection_rolls_back_entire_batch_if_a_sample_id_is_missing() {
    let mut conn = setup_db();
    for (path, file_name) in [("/tmp/one.wav", "one.wav"), ("/tmp/two.wav", "two.wav")] {
        conn.execute(
            "INSERT INTO samples (path, file_name) VALUES (?1, ?2)",
            params![path, file_name],
        )
        .expect("insert sample");
    }

    let collection_id = super::add_samples_to_collection(&mut conn, "valid", &[1])
        .expect("seed collection")
        .collection_id;

    let err = super::add_samples_to_collection(&mut conn, "valid", &[1, 999]).unwrap_err();
    let err_text = err.to_string();
    assert!(err_text.contains("no rows") || err_text.contains("constraint"));

    assert_eq!(
        super::list_collection_member_sample_ids(&conn, collection_id).unwrap(),
        vec![1]
    );
    assert_eq!(super::list_collections(&conn).unwrap().len(), 1);
}

#[test]
fn normalize_collection_name_normalizes_unicode_whitespace_and_case() {
    assert_eq!(
        super::normalize_collection_name("  Drum\u{00A0}Rack\u{2003}\tKiCk\u{00A0}")
            .expect("should normalize"),
        "drum rack kick"
    );
}

#[test]
fn normalize_collection_name_rejects_empty() {
    let err = super::normalize_collection_name("   ").expect_err("empty name should fail");
    assert!(matches!(err, rusqlite::Error::InvalidParameterName(_)));
}
