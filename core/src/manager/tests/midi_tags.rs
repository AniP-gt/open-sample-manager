use tempfile::TempDir;

use super::helpers::{make_manager, touch_files};

#[test]
fn manager_midi_tag_facade_roundtrip() {
    let dir = TempDir::new().unwrap();
    touch_files(&dir, &["tagged.mid"]);
    let midi_path = dir.path().join("tagged.mid");
    let manager = make_manager();
    assert_eq!(
        manager
            .scan_midi_directory(dir.path())
            .expect("midi scan failed"),
        1
    );
    let midi = manager
        .get_midi(midi_path.to_str().expect("utf8 midi path"))
        .expect("get midi failed")
        .expect("midi missing");

    let tag_id = manager
        .add_midi_tag("phase4-manager-midi")
        .expect("add midi tag failed");
    assert!(manager
        .get_all_midi_tags()
        .expect("list midi tags failed")
        .iter()
        .any(|tag| tag.id == tag_id && tag.name == "phase4-manager-midi"));

    manager
        .update_midi_tag(tag_id, "phase4-manager-updated")
        .expect("update midi tag failed");
    manager
        .set_midi_file_tag(midi.id, Some(tag_id))
        .expect("set midi file tag failed");
    let assigned = manager
        .get_midi_file_tags(midi.id)
        .expect("get midi file tags failed");
    assert_eq!(assigned.len(), 1);
    assert_eq!(assigned[0].name, "phase4-manager-updated");
    assert_eq!(
        manager
            .search_midis("updated")
            .expect("search tagged midi failed")
            .len(),
        1
    );

    manager
        .set_midi_file_tag(midi.id, None)
        .expect("remove midi file tag failed");
    assert!(manager
        .get_midi_file_tags(midi.id)
        .expect("get removed midi file tags failed")
        .is_empty());
    assert!(manager
        .search_midis("updated")
        .expect("search removed tag failed")
        .is_empty());
    assert_eq!(
        manager
            .delete_midi_tag(tag_id)
            .expect("delete midi tag failed"),
        1
    );
}
