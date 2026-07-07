use tempfile::TempDir;

use super::helpers::{make_manager, write_wav};

#[test]
fn manager_records_and_lists_project_usage() {
    let manager = make_manager();
    let dir = TempDir::new().expect("temp dir");
    let first_path = write_wav(&dir, "kick.wav", 2048);
    let second_path = write_wav(&dir, "snare.wav", 2048);
    let first_id = manager
        .import_file(&first_path)
        .expect("import first sample");
    let second_id = manager
        .import_file(&second_path)
        .expect("import second sample");
    let project = manager.get_default_project().expect("default project");

    manager
        .record_project_sample_selection(Some(&project.id), first_id)
        .expect("selection event");
    manager
        .record_project_sample_export(Some(&project.id), first_id, "raw")
        .expect("export event");
    manager
        .add_project_collection_sample(Some(&project.id), second_id)
        .expect("collection add");

    let events = manager
        .list_project_usage_events(Some(&project.id))
        .expect("usage events");
    let used_ids = manager
        .list_project_used_sample_ids(Some(&project.id))
        .expect("used ids");

    assert_eq!(events.len(), 2);
    assert_eq!(used_ids, vec![first_id, second_id]);
}
