use tempfile::TempDir;

use super::helpers::{make_manager, write_wav};
use crate::SampleManager;

#[test]
fn manager_collection_crud_roundtrip() {
    let dir = TempDir::new().unwrap();
    write_wav(&dir, "kick_01.wav", 11_025);
    write_wav(&dir, "kick_02.wav", 11_025);
    write_wav(&dir, "snare.wav", 11_025);

    let mut manager = make_manager();
    manager.scan_directory(dir.path()).unwrap();

    let mut samples = manager.search("kick").unwrap();
    samples.sort_by(|a, b| a.file_name.cmp(&b.file_name));
    let sample_ids: Vec<i64> = samples.iter().map(|sample| sample.id).collect();
    assert_eq!(sample_ids.len(), 2);

    let add_result = manager
        .add_samples_to_collection("  Drum    Rack  ", &sample_ids)
        .unwrap();
    assert!(add_result.created);
    assert_eq!(add_result.added_count, 2);

    let collection = manager
        .list_collections()
        .unwrap()
        .pop()
        .expect("collection should exist");
    assert_eq!(collection.name, "drum rack");
    assert_eq!(collection.sample_count, 2);

    let duplicates = manager
        .add_samples_to_collection("drum rack", &sample_ids)
        .unwrap();
    assert!(!duplicates.created);
    assert_eq!(duplicates.added_count, 0);

    let members = manager.get_collection_members(collection.id).unwrap();
    assert_eq!(members.len(), 2);
    assert_eq!(members[0].file_name, "kick_01.wav");
    assert_eq!(members[1].file_name, "kick_02.wav");

    let positions = manager
        .list_collection_members_with_positions(collection.id)
        .unwrap();
    assert_eq!(positions.len(), 2);
    assert_eq!(positions[0].position, 1);
    assert_eq!(positions[1].position, 2);

    let sample_ids_from_ids = manager
        .list_collection_member_sample_ids(collection.id)
        .unwrap();
    assert_eq!(sample_ids_from_ids.len(), 2);
}

#[test]
fn manager_add_samples_to_collection_rejects_empty_batch() {
    let dir = TempDir::new().unwrap();
    write_wav(&dir, "kick_01.wav", 11_025);

    let mut manager = make_manager();
    manager.scan_directory(dir.path()).unwrap();

    let err = manager
        .add_samples_to_collection("drum", &[])
        .expect_err("empty sample list should fail");
    let message = err.to_string();
    assert!(
        message.contains("Invalid parameter") || message.contains("database error"),
        "unexpected error for empty batch: {message}"
    );
}

#[test]
fn manager_add_samples_to_collection_does_not_partially_write_when_id_missing() {
    let dir = TempDir::new().unwrap();
    write_wav(&dir, "kick_01.wav", 11_025);

    let mut manager = make_manager();
    manager.scan_directory(dir.path()).unwrap();

    manager
        .add_samples_to_collection("unwritten", &[9_999])
        .expect_err("missing first sample should fail without creating a collection");
    assert!(manager.list_collections().unwrap().is_empty());

    let collection_id = manager
        .add_samples_to_collection("drum", &[1])
        .unwrap()
        .collection_id;

    let err = manager
        .add_samples_to_collection("drum", &[1, 9_999])
        .expect_err("missing sample id should fail");
    let message = err.to_string();
    assert!(message.contains("no rows") || message.contains("constraint"));

    let members = manager.get_collection_members(collection_id).unwrap();
    assert_eq!(members.len(), 1);
}

#[test]
fn manager_file_backed_collections_preserve_order_counts_and_idempotent_retries() {
    let dir = TempDir::new().unwrap();
    let database_path = dir.path().join("collections.db");
    write_wav(&dir, "one.wav", 11_025);
    write_wav(&dir, "two.wav", 11_025);
    write_wav(&dir, "three.wav", 11_025);

    let mut manager = SampleManager::new(Some(database_path.to_str().unwrap())).unwrap();
    manager.scan_directory(dir.path()).unwrap();
    let mut samples = manager.search("").unwrap();
    samples.sort_by(|left, right| left.file_name.cmp(&right.file_name));
    let ordered_ids = [samples[2].id, samples[0].id, samples[1].id];

    let first_add = manager
        .add_samples_to_collection("  File\u{00A0}Backed  ", &ordered_ids)
        .unwrap();
    let retry = manager
        .add_samples_to_collection("file backed", &ordered_ids)
        .unwrap();
    let collection = manager
        .get_collection_by_id(first_add.collection_id)
        .unwrap()
        .unwrap();
    let members = manager
        .list_collection_member_sample_ids(first_add.collection_id)
        .unwrap();

    assert!(first_add.created);
    assert_eq!(first_add.added_count, 3);
    assert!(!retry.created);
    assert_eq!(retry.added_count, 0);
    assert_eq!(collection.name, "file backed");
    assert_eq!(collection.sample_count, 3);
    assert_eq!(members, ordered_ids);
}

#[test]
fn manager_collection_members_preserve_requested_insertion_order() {
    // Given: three indexed samples and a collection added in a non-search order.
    let dir = TempDir::new().unwrap();
    write_wav(&dir, "one.wav", 11_025);
    write_wav(&dir, "two.wav", 11_025);
    write_wav(&dir, "three.wav", 11_025);
    let mut manager = make_manager();
    manager.scan_directory(dir.path()).unwrap();
    let samples = manager.search("").unwrap();
    let ordered_ids = vec![samples[2].id, samples[0].id, samples[1].id];
    let collection_id = manager
        .add_samples_to_collection("desktop order", &ordered_ids)
        .unwrap()
        .collection_id;

    // When: the desktop-facing members are loaded through the core facade.
    let members = manager.get_collection_members(collection_id).unwrap();

    // Then: their returned order is the collection insertion order.
    assert_eq!(
        members.iter().map(|sample| sample.id).collect::<Vec<_>>(),
        ordered_ids
    );
}

#[test]
fn manager_list_collections_orders_multiple_named_collections_deterministically() {
    // Given: two named collections created in a deliberate insertion order.
    let dir = TempDir::new().unwrap();
    write_wav(&dir, "kick.wav", 11_025);
    let mut manager = make_manager();
    manager.scan_directory(dir.path()).unwrap();
    let sample_id = manager.search("").unwrap()[0].id;
    manager
        .add_samples_to_collection("zebra drums", &[sample_id])
        .unwrap();
    manager
        .add_samples_to_collection("alpha drums", &[sample_id])
        .unwrap();

    // When: the desktop collection list is loaded repeatedly.
    let first = manager.list_collections().unwrap();
    let second = manager.list_collections().unwrap();

    // Then: both reads retain the deterministic creation/id order.
    assert_eq!(
        first
            .iter()
            .map(|collection| &collection.name)
            .collect::<Vec<_>>(),
        vec!["zebra drums", "alpha drums"]
    );
    assert_eq!(first, second);
}
