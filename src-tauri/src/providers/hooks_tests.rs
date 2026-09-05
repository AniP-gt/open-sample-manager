#[test]
fn ready_emit_failure_never_removes_the_returned_selected_root() {
    let hooks = include_str!("hooks.rs");
    let ready = hooks
        .split("Ok(directory) =>")
        .nth(1)
        .expect("successful import branch must exist")
        .split("Err(error) =>")
        .next()
        .expect("successful import branch must end before errors");

    assert!(!ready.contains("remove_dir_all"));
}
