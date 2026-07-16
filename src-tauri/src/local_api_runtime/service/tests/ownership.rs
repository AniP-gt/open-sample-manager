use super::super::{start_local_api_with, LocalApiDataDirectory};
use crate::local_api_runtime::manifest::{
    new_manifest, read_connection_manifest, write_manifest_atomically,
};
use std::net::TcpListener;
use tempfile::tempdir;

fn data_directory() -> (tempfile::TempDir, LocalApiDataDirectory) {
    let dir = tempdir().expect("temporary app data directory");
    let data_dir = LocalApiDataDirectory::new(dir.path().to_path_buf());
    (dir, data_dir)
}

#[test]
fn lifecycle_reclaims_stale_manifest_when_pid_was_reused_by_current_process() {
    // Given: a stale manifest whose recorded PID has been reused by this process.
    let (_dir, app_data_dir) = data_directory();
    let stale_manifest = new_manifest("stale-token".to_owned(), "stale-instance".to_owned());
    let manifest_path = app_data_dir.manifest_path();
    write_manifest_atomically(&stale_manifest, &manifest_path).expect("write stale manifest");

    // When: this process successfully binds a new local API listener.
    let mut runtime = start_local_api_with(app_data_dir, || TcpListener::bind("127.0.0.1:0"))
        .expect("stale manifest must not block a newly bound API instance");

    // Then: a fresh instance replaces it without authenticating to the stale endpoint.
    let replacement = read_connection_manifest(runtime.manifest_path())
        .expect("read replacement manifest")
        .expect("replacement manifest");
    assert_ne!(replacement.token, stale_manifest.token);
    assert_ne!(replacement.instance_id, stale_manifest.instance_id);
    runtime.shutdown();
}

#[test]
fn lifecycle_reclaims_manifest_for_a_dead_process() {
    let (_dir, app_data_dir) = data_directory();
    let mut stale_manifest = new_manifest("dead-token".to_owned(), "dead-instance".to_owned());
    stale_manifest.pid = 0;
    let manifest_path = app_data_dir.manifest_path();
    write_manifest_atomically(&stale_manifest, &manifest_path).expect("write dead manifest");

    let mut runtime = start_local_api_with(app_data_dir, || TcpListener::bind("127.0.0.1:0"))
        .expect("dead manifest must not block startup");

    let replacement = read_connection_manifest(runtime.manifest_path())
        .expect("read replacement manifest")
        .expect("replacement manifest");
    assert_ne!(replacement.instance_id, stale_manifest.instance_id);
    runtime.shutdown();
}

#[test]
fn lifecycle_keeps_live_owner_manifest_when_its_listener_is_occupied() {
    let (_dir, app_data_dir) = data_directory();
    let listener = TcpListener::bind("127.0.0.1:0").expect("bind owner listener");
    let address = listener.local_addr().expect("owner listener address");
    let mut owner =
        start_local_api_with(app_data_dir.clone(), move || Ok(listener)).expect("start owner");
    let owner_manifest = read_connection_manifest(owner.manifest_path())
        .expect("read owner manifest")
        .expect("owner manifest");

    let result = start_local_api_with(app_data_dir, move || TcpListener::bind(address));

    assert!(matches!(
        result,
        Err(crate::local_api_runtime::manifest::LocalApiLifecycleError::Bind(_))
    ));
    let retained_manifest = read_connection_manifest(owner.manifest_path())
        .expect("read retained manifest")
        .expect("retained manifest");
    assert_eq!(retained_manifest.instance_id, owner_manifest.instance_id);
    owner.shutdown();
}

#[test]
fn shutdown_removes_only_the_owning_instance_manifest() {
    let (_dir, app_data_dir) = data_directory();
    let mut owner = start_local_api_with(app_data_dir, || TcpListener::bind("127.0.0.1:0"))
        .expect("start owner");
    let replacement = new_manifest(
        "replacement-token".to_owned(),
        "replacement-instance".to_owned(),
    );
    write_manifest_atomically(&replacement, owner.manifest_path()).expect("publish replacement");

    owner.shutdown();

    let retained_manifest = read_connection_manifest(owner.manifest_path())
        .expect("read retained manifest")
        .expect("retained manifest");
    assert_eq!(retained_manifest.instance_id, replacement.instance_id);
}
