use crate::db::operations::{
    delete_sample, get_all_sample_paths, get_sample_by_id, get_sample_by_path, insert_sample,
    list_samples_around_id, list_samples_paginated,
};

use super::{make_input, setup_db};

#[test]
fn get_sample_by_id_and_path_return_inserted_row() {
    let conn = setup_db();
    let id = insert_sample(
        &conn,
        &make_input("/samples/query-kick.wav", "query-kick.wav"),
    )
    .expect("insert failed");

    let by_id = get_sample_by_id(&conn, id)
        .expect("id lookup failed")
        .expect("sample not found by id");
    let by_path = get_sample_by_path(&conn, "/samples/query-kick.wav")
        .expect("path lookup failed")
        .expect("sample not found by path");

    assert_eq!(by_id.path, "/samples/query-kick.wav");
    assert_eq!(by_path.id, id);
    assert_eq!(by_path.file_name, "query-kick.wav");
}

#[test]
fn get_sample_by_id_and_path_return_none_for_missing_rows() {
    let conn = setup_db();

    assert!(get_sample_by_id(&conn, -1)
        .expect("missing id lookup failed")
        .is_none());
    assert!(get_sample_by_path(&conn, "/samples/missing.wav")
        .expect("missing path lookup failed")
        .is_none());
}

#[test]
fn list_samples_paginated_returns_deterministic_page() {
    let conn = setup_db();
    insert_sample(&conn, &make_input("/samples/one.wav", "one.wav")).expect("insert one failed");
    insert_sample(&conn, &make_input("/samples/two.wav", "two.wav")).expect("insert two failed");
    insert_sample(&conn, &make_input("/samples/three.wav", "three.wav"))
        .expect("insert three failed");

    let page = list_samples_paginated(&conn, 2, 1, None).expect("list failed");

    assert_eq!(page.len(), 2);
    assert_eq!(page[0].file_name, "two.wav");
    assert_eq!(page[1].file_name, "three.wav");
}

#[test]
fn list_samples_around_id_includes_target_and_neighbors() {
    let conn = setup_db();
    insert_sample(&conn, &make_input("/samples/one.wav", "one.wav")).expect("insert one failed");
    insert_sample(&conn, &make_input("/samples/two.wav", "two.wav")).expect("insert two failed");
    let target_id = insert_sample(&conn, &make_input("/samples/three.wav", "three.wav"))
        .expect("insert three failed");
    insert_sample(&conn, &make_input("/samples/four.wav", "four.wav")).expect("insert four failed");
    insert_sample(&conn, &make_input("/samples/five.wav", "five.wav")).expect("insert five failed");

    let rows = list_samples_around_id(&conn, target_id, 3).expect("around id lookup failed");
    let file_names: Vec<&str> = rows.iter().map(|row| row.file_name.as_str()).collect();

    assert_eq!(file_names, vec!["two.wav", "three.wav", "four.wav"]);
}

#[test]
fn get_all_sample_paths_returns_inserted_paths_and_excludes_deleted_rows() {
    let conn = setup_db();
    insert_sample(&conn, &make_input("/samples/keep-one.wav", "keep-one.wav"))
        .expect("insert keep one failed");
    insert_sample(&conn, &make_input("/samples/remove.wav", "remove.wav"))
        .expect("insert remove failed");
    insert_sample(&conn, &make_input("/samples/keep-two.wav", "keep-two.wav"))
        .expect("insert keep two failed");

    delete_sample(&conn, "/samples/remove.wav").expect("delete failed");
    let paths = get_all_sample_paths(&conn).expect("paths lookup failed");

    assert_eq!(
        paths,
        vec!["/samples/keep-one.wav", "/samples/keep-two.wav"]
    );
}
