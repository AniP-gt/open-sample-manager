use tempfile::TempDir;

use super::super::SampleManager;

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
