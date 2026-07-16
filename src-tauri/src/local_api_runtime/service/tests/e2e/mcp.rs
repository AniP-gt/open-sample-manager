use super::support::{manager_with_samples, request, HttpRequest};
use crate::external_commands::UiCommandQueue;
use crate::local_api_runtime::manifest::read_connection_manifest;
use crate::local_api_runtime::service::tests::FIXED_LOOPBACK_TEST_LOCK;
use crate::local_api_runtime::service::{
    bind_local_api_listener, start_local_api_with_manager, LocalApiDataDirectory,
};
use std::path::PathBuf;
use std::process::Command;
use std::sync::{Arc, Mutex};
use tempfile::tempdir;

#[test]
#[ignore = "requires `npm ci --prefix mcp-server`; run `cargo test -p open-sample-manager built_stdio_mcp_client_calls_all_operations_against_fixed_loopback_api -- --ignored --test-threads=1`"]
fn built_stdio_mcp_client_calls_all_operations_against_fixed_loopback_api() {
    let _lock = FIXED_LOOPBACK_TEST_LOCK
        .get_or_init(|| Mutex::new(()))
        .lock()
        .expect("fixed loopback test lock");
    let workspace = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..");
    let probe = workspace.join("mcp-server/tests/real-surface-probe.mjs");

    assert!(probe.is_file(), "the MCP stdio probe must be present");

    let data_dir = tempdir().expect("temporary data directory");
    let database_dir = tempdir().expect("temporary database directory");
    let (manager, ids) = manager_with_samples(&database_dir.path().join("samples.db"));
    let manager = Arc::new(Mutex::new(manager));
    let queue = Arc::new(UiCommandQueue::with_capacity(16));
    let mut first_runtime = start_local_api_with_manager(
        LocalApiDataDirectory::new(data_dir.path().to_path_buf()),
        Arc::clone(&manager),
        Arc::clone(&queue),
        bind_local_api_listener,
    )
    .expect("fixed loopback API starts for serialized MCP smoke");
    let manifest_path = first_runtime.manifest_path().to_path_buf();
    let stale_manifest = read_connection_manifest(&manifest_path)
        .expect("read first manifest")
        .expect("first manifest exists");
    first_runtime.shutdown();
    let mut runtime = start_local_api_with_manager(
        LocalApiDataDirectory::new(data_dir.path().to_path_buf()),
        Arc::clone(&manager),
        queue,
        bind_local_api_listener,
    )
    .expect("rotated fixed loopback API starts");
    let rotated_manifest = read_connection_manifest(runtime.manifest_path())
        .expect("read rotated manifest")
        .expect("rotated manifest exists");
    let stale_response = request(
        "127.0.0.1:37421".parse().expect("fixed address"),
        HttpRequest {
            token: &stale_manifest.token,
            host: "127.0.0.1:37421",
            origin: None,
            path: "/v1/search_samples",
            body: r#"{"request_id":"stale-manifest","operation":"search_samples"}"#,
        },
    );
    assert_eq!(stale_response.status, 401);
    assert_ne!(stale_manifest.instance_id, rotated_manifest.instance_id);
    let build = Command::new("npm")
        .args(["run", "build", "--prefix", "mcp-server"])
        .current_dir(&workspace)
        .output()
        .expect("run MCP build");
    assert!(
        build.status.success(),
        "MCP build failed without emitting credentials"
    );
    let probe_output = Command::new("node")
        .arg(&probe)
        .arg(runtime.manifest_path())
        .arg(ids.source.to_string())
        .arg(ids.similar.to_string())
        .current_dir(&workspace)
        .output()
        .expect("run MCP stdio probe");

    assert!(
        probe_output.status.success(),
        "built MCP stdio probe failed without emitting credentials"
    );
    assert_eq!(
        String::from_utf8_lossy(&probe_output.stdout).trim(),
        "mcp real-surface probe passed"
    );
    assert!(!String::from_utf8_lossy(&probe_output.stderr).contains("Bearer "));

    runtime.shutdown();
    assert!(!runtime.manifest_path().exists());
}
