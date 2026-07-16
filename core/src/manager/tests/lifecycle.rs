use rusqlite::Connection;
use tempfile::TempDir;

use super::super::SampleManager;
use super::helpers::write_wav;

#[test]
fn new_creates_in_memory_manager() {
    let manager = SampleManager::new(None);
    assert!(manager.is_ok());
}

#[test]
fn new_creates_file_backed_manager() {
    let dir = TempDir::new().unwrap();
    let db_path = dir.path().join("test.db");
    let manager = SampleManager::new(Some(db_path.to_str().unwrap()));
    assert!(manager.is_ok());
}

#[test]
fn export_library_database_writes_database_only() {
    let library_dir = TempDir::new().unwrap();
    write_wav(&library_dir, "kick.wav", 11_025);
    let db_dir = TempDir::new().unwrap();
    let db_path = db_dir.path().join("samples.db");
    let mut manager = SampleManager::new(Some(db_path.to_str().unwrap())).unwrap();
    manager.scan_directory(library_dir.path()).unwrap();
    let sample_id = manager.search("kick").unwrap()[0].id;
    manager
        .add_samples_to_collection("exported", &[sample_id])
        .unwrap();

    let export_dir = TempDir::new().unwrap();
    let summary = manager.export_library_database(export_dir.path()).unwrap();

    assert_eq!(summary.sample_count, 1);
    assert_eq!(summary.midi_count, 0);
    assert!(export_dir.path().join("samples.db").exists());
    assert!(!export_dir.path().join("manifest.json").exists());
    let exported_conn = Connection::open(export_dir.path().join("samples.db")).unwrap();
    let exported_members: i64 = exported_conn
        .query_row("SELECT COUNT(*) FROM collection_members", [], |row| {
            row.get(0)
        })
        .unwrap();
    assert_eq!(exported_members, 1);
}

#[test]
fn import_library_database_replaces_current_database() {
    let source_library_dir = TempDir::new().unwrap();
    let sample_path = write_wav(&source_library_dir, "snare.wav", 11_025);
    let source_db_dir = TempDir::new().unwrap();
    let source_db_path = source_db_dir.path().join("samples.db");
    let source_manager = SampleManager::new(Some(source_db_path.to_str().unwrap())).unwrap();
    source_manager
        .scan_directory(source_library_dir.path())
        .unwrap();

    let export_dir = TempDir::new().unwrap();
    source_manager
        .export_library_database(export_dir.path())
        .unwrap();

    let target_db_dir = TempDir::new().unwrap();
    let target_db_path = target_db_dir.path().join("samples.db");
    let mut target_manager = SampleManager::new(Some(target_db_path.to_str().unwrap())).unwrap();

    let summary = target_manager
        .import_library_database(export_dir.path())
        .unwrap();

    assert_eq!(summary.sample_count, 1);
    let imported = target_manager
        .get_sample(sample_path.to_str().unwrap())
        .unwrap()
        .unwrap();
    assert_eq!(imported.file_name, "snare.wav");
    assert_eq!(target_manager.search("snare").unwrap().len(), 1);
}

#[test]
fn import_library_database_upgrades_legacy_export_without_collections() {
    let source_library_dir = TempDir::new().unwrap();
    let sample_path = write_wav(&source_library_dir, "legacy.wav", 11_025);
    let source_db_dir = TempDir::new().unwrap();
    let source_db_path = source_db_dir.path().join("samples.db");
    let source_manager = SampleManager::new(Some(source_db_path.to_str().unwrap())).unwrap();
    source_manager
        .scan_directory(source_library_dir.path())
        .unwrap();

    let export_dir = TempDir::new().unwrap();
    source_manager
        .export_library_database(export_dir.path())
        .unwrap();
    let legacy_export = export_dir.path().join("samples.db");
    let legacy_conn = Connection::open(&legacy_export).unwrap();
    legacy_conn
        .execute_batch("DROP TABLE collection_members; DROP TABLE collections;")
        .unwrap();
    drop(legacy_conn);

    let target_db_dir = TempDir::new().unwrap();
    let target_db_path = target_db_dir.path().join("samples.db");
    let mut target_manager = SampleManager::new(Some(target_db_path.to_str().unwrap())).unwrap();

    let summary = target_manager
        .import_library_database(export_dir.path())
        .unwrap();

    assert_eq!(summary.sample_count, 1);
    assert!(target_manager
        .get_sample(sample_path.to_str().unwrap())
        .unwrap()
        .is_some());
    assert!(target_manager.list_collections().unwrap().is_empty());
}

#[test]
fn import_library_database_rejects_corrupt_export_without_replacing_current_database() {
    let current_library_dir = TempDir::new().unwrap();
    let current_sample_path = write_wav(&current_library_dir, "current.wav", 11_025);
    let db_dir = TempDir::new().unwrap();
    let db_path = db_dir.path().join("samples.db");
    let mut manager = SampleManager::new(Some(db_path.to_str().unwrap())).unwrap();
    manager.scan_directory(current_library_dir.path()).unwrap();

    let export_dir = TempDir::new().unwrap();
    manager.export_library_database(export_dir.path()).unwrap();
    std::fs::write(export_dir.path().join("samples.db"), b"not sqlite").unwrap();

    let result = manager.import_library_database(export_dir.path());

    assert!(result.is_err());
    assert!(manager
        .get_sample(current_sample_path.to_str().unwrap())
        .unwrap()
        .is_some());
}
