use super::{
    bind_local_api_listener, generate_token, start_local_api_with, start_local_api_with_manager,
    LocalApiDataDirectory,
};
use crate::external_commands::{UiCommand, UiCommandQueue};
use crate::local_api_runtime::manifest::{read_connection_manifest, LocalApiLifecycleError};
use open_sample_manager_core::{
    db::operations::{insert_sample, SampleInput},
    SampleManager,
};
use std::io::{self, Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::{Arc, Mutex, OnceLock};
use std::time::Duration;
use tempfile::tempdir;

#[path = "tests/e2e/mod.rs"]
mod e2e;
#[path = "tests/ownership.rs"]
mod ownership;

pub(super) static FIXED_LOOPBACK_TEST_LOCK: OnceLock<Mutex<()>> = OnceLock::new();

fn data_directory() -> (tempfile::TempDir, LocalApiDataDirectory) {
    let dir = tempdir().expect("temporary app data directory");
    let data_dir = LocalApiDataDirectory::new(dir.path().to_path_buf());
    (dir, data_dir)
}

#[test]
fn lifecycle_publishes_rotating_manifest_only_after_listener_bind() {
    let (_dir, app_data_dir) = data_directory();
    let mut first = start_local_api_with(app_data_dir.clone(), || TcpListener::bind("127.0.0.1:0"))
        .expect("first lifecycle starts");
    let first_manifest = read_connection_manifest(first.manifest_path())
        .expect("read first manifest")
        .expect("first manifest published");
    first.shutdown();

    let mut second = start_local_api_with(app_data_dir, || TcpListener::bind("127.0.0.1:0"))
        .expect("second lifecycle starts");
    let second_manifest = read_connection_manifest(second.manifest_path())
        .expect("read second manifest")
        .expect("second manifest published");

    assert_eq!(first_manifest.token.len(), 64);
    assert_ne!(first_manifest.token, second_manifest.token);
    assert_ne!(first_manifest.instance_id, second_manifest.instance_id);
    second.shutdown();
}

#[test]
fn bind_failure_never_publishes_or_replaces_manifest() {
    let (_dir, app_data_dir) = data_directory();
    let result = start_local_api_with(app_data_dir.clone(), || {
        Err(io::Error::from(io::ErrorKind::AddrInUse))
    });

    assert!(matches!(result, Err(LocalApiLifecycleError::Bind(_))));
    assert!(!app_data_dir.manifest_path().exists());
}

#[test]
fn lifecycle_replaces_manifest_when_a_new_listener_is_bound() {
    let (_dir, app_data_dir) = data_directory();
    let mut owner = start_local_api_with(app_data_dir.clone(), || TcpListener::bind("127.0.0.1:0"))
        .expect("owner lifecycle starts");
    let original = read_connection_manifest(owner.manifest_path())
        .expect("read owner manifest")
        .expect("owner manifest");

    let mut replacement = start_local_api_with(app_data_dir, || TcpListener::bind("127.0.0.1:0"))
        .expect("replacement lifecycle starts");
    let replacement_manifest = read_connection_manifest(replacement.manifest_path())
        .expect("read replacement manifest")
        .expect("replacement manifest");

    assert_ne!(replacement_manifest.instance_id, original.instance_id);
    owner.shutdown();
    replacement.shutdown();
}

#[cfg(unix)]
#[test]
fn lifecycle_disables_api_when_manifest_parent_is_unwritable() {
    use std::os::unix::fs::PermissionsExt;

    let (_dir, app_data_dir) = data_directory();
    let manifest_path = app_data_dir.manifest_path();
    let parent = manifest_path.parent().expect("manifest parent");
    std::fs::set_permissions(parent, std::fs::Permissions::from_mode(0o500))
        .expect("make manifest parent unwritable");

    let result = start_local_api_with(app_data_dir.clone(), || TcpListener::bind("127.0.0.1:0"));

    std::fs::set_permissions(parent, std::fs::Permissions::from_mode(0o700))
        .expect("restore manifest parent permissions");

    assert!(matches!(result, Err(LocalApiLifecycleError::Write(_))));
    assert!(!app_data_dir.manifest_path().exists());
}

#[test]
fn graceful_shutdown_removes_owned_manifest() {
    let (_dir, app_data_dir) = data_directory();
    let mut runtime =
        start_local_api_with(app_data_dir.clone(), || TcpListener::bind("127.0.0.1:0"))
            .expect("lifecycle starts");
    let manifest_path = runtime.manifest_path().to_path_buf();

    runtime.shutdown();

    assert!(!manifest_path.exists());
}

#[test]
fn lifecycle_serves_manifest_authenticated_requests_and_releases_its_listener() {
    let (_dir, app_data_dir) = data_directory();
    let listener = TcpListener::bind("127.0.0.1:0").expect("temporary loopback listener");
    let address = listener.local_addr().expect("listener address");
    let mut runtime =
        start_local_api_with(app_data_dir, move || Ok(listener)).expect("lifecycle starts");
    let manifest = read_connection_manifest(runtime.manifest_path())
        .expect("read connection manifest")
        .expect("published connection manifest");
    let request_body = r#"{"request_id":"socket_harness","operation":"search_samples"}"#;
    let request = format!(
        "POST /v1/search_samples HTTP/1.1\r\nHost: 127.0.0.1:37421\r\nAuthorization: Bearer {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        manifest.token,
        request_body.len(),
        request_body,
    );
    let mut client = TcpStream::connect(address).expect("connect to local API");
    client
        .set_read_timeout(Some(Duration::from_secs(2)))
        .expect("set socket read timeout");
    client.write_all(request.as_bytes()).expect("send request");
    let mut response = String::new();
    client.read_to_string(&mut response).expect("read response");

    assert!(response.starts_with("HTTP/1.1 200"));
    runtime.shutdown();
    assert!(TcpListener::bind(address).is_ok());
}

#[test]
fn lifecycle_serves_real_manager_backed_read_routes() {
    // Given: a shared manager with an embedded source and match sample.
    let (_data_dir, app_data_dir) = data_directory();
    let database_dir = tempdir().expect("temporary database directory");
    let database_path = database_dir.path().join("samples.db");
    let database_path_string = database_path.to_string_lossy().to_string();
    let manager = SampleManager::new(Some(&database_path_string)).expect("sample manager");
    let connection = rusqlite::Connection::open(&database_path).expect("seed connection");
    let source_id = seed_sample(&connection, "source.wav", vector([1.0, 0.0]));
    let match_id = seed_sample(&connection, "match.wav", vector([0.8, 0.6]));
    let listener = TcpListener::bind("127.0.0.1:0").expect("temporary loopback listener");
    let address = listener.local_addr().expect("listener address");
    let manager = Arc::new(Mutex::new(manager));
    let ui_commands = Arc::new(UiCommandQueue::with_capacity(4));
    let mut runtime = start_local_api_with_manager(
        app_data_dir,
        Arc::clone(&manager),
        Arc::clone(&ui_commands),
        move || Ok(listener),
    )
    .expect("manager-backed lifecycle starts");
    let manifest = read_connection_manifest(runtime.manifest_path())
        .expect("read connection manifest")
        .expect("published connection manifest");

    // When: authenticated TCP requests call every read route.
    let search = send_authenticated_request(
        address,
        &manifest.token,
        "/v1/search_samples",
        r#"{"request_id":"runtime-search","operation":"search_samples","limit":10}"#,
    );
    let get = send_authenticated_request(
        address,
        &manifest.token,
        "/v1/get_sample",
        &format!(
            r#"{{"request_id":"runtime-get","operation":"get_sample","sample_id":{source_id}}}"#
        ),
    );
    let similar = send_authenticated_request(
        address,
        &manifest.token,
        "/v1/find_similar_samples",
        &format!(
            r#"{{"request_id":"runtime-similar","operation":"find_similar_samples","sample_id":{source_id},"limit":1}}"#
        ),
    );
    let show = send_authenticated_request(
        address,
        &manifest.token,
        "/v1/show_samples_in_app",
        &format!(
            r#"{{"request_id":"runtime-show","operation":"show_samples_in_app","sample_ids":[{match_id},{source_id}],"selected_id":{source_id}}}"#
        ),
    );
    let preview = send_authenticated_request(
        address,
        &manifest.token,
        "/v1/preview_sample",
        &format!(
            r#"{{"request_id":"runtime-preview","operation":"preview_sample","sample_id":{source_id}}}"#
        ),
    );
    let collection = send_authenticated_request(
        address,
        &manifest.token,
        "/v1/add_to_collection",
        &format!(
            r#"{{"request_id":"runtime-collection","operation":"add_to_collection","collection_name":"runtime","sample_ids":[{match_id},{source_id}]}}"#
        ),
    );

    // Then: real DTOs are served rather than the accepted stub response.
    assert!(search.contains(&format!(r#""id":{source_id}"#)));
    assert!(get.contains(&format!(r#""sample":{{"id":{source_id}"#)));
    assert!(similar.contains(&format!(r#""sample":{{"id":{match_id}"#)));
    assert!(!search.contains(r#""accepted":true"#));
    assert!(show.starts_with("HTTP/1.1 202"));
    assert!(preview.starts_with("HTTP/1.1 202"));
    assert!(collection.starts_with("HTTP/1.1 202"));
    assert_eq!(
        ui_commands
            .claim()
            .into_iter()
            .map(|lease| lease.command)
            .collect::<Vec<_>>(),
        vec![
            UiCommand::ShowSamples {
                sample_ids: vec![match_id, source_id],
                selected_id: Some(source_id),
            },
            UiCommand::PreviewSample {
                sample_id: source_id
            },
            UiCommand::CollectionsChanged,
        ]
    );
    assert_eq!(
        manager
            .lock()
            .expect("manager lock")
            .list_collections()
            .expect("collections")
            .len(),
        1
    );
    runtime.shutdown();
    assert!(TcpListener::bind(address).is_ok());
}

fn seed_sample(connection: &rusqlite::Connection, file_name: &str, embedding: Vec<u8>) -> i64 {
    insert_sample(
        connection,
        &SampleInput {
            path: format!("/library/{file_name}"),
            file_name: file_name.to_owned(),
            duration: Some(1.0),
            bpm: Some(128.0),
            periodicity: None,
            sample_rate: Some(44_100),
            file_size: Some(512),
            artist: None,
            low_ratio: None,
            sample_type: Some("oneshot".to_owned()),
            waveform_peaks: Some("[0.1]".to_owned()),
            attack_slope: None,
            decay_time: None,
            embedding: Some(embedding),
            source: None,
            pack_name: None,
            license: None,
            license_url: None,
            license_memo: None,
            imported_at: None,
            peak_db: None,
            rms_db: None,
            leading_silence_ms: None,
            clipping_count: None,
            channel_count: None,
            bit_depth: None,
            quality_flags: None,
            playback_type: Some("oneshot".to_owned()),
            instrument_type: Some("kick".to_owned()),
            musical_key: Some("C".to_owned()),
            content_hash: None,
        },
    )
    .expect("seed sample")
}

fn vector(values: [f32; 2]) -> Vec<u8> {
    values.into_iter().flat_map(f32::to_le_bytes).collect()
}

fn send_authenticated_request(
    address: std::net::SocketAddr,
    token: &str,
    path: &str,
    body: &str,
) -> String {
    let request = format!(
        "POST {path} HTTP/1.1\r\nHost: 127.0.0.1:37421\r\nAuthorization: Bearer {token}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
        body.len(),
    );
    let mut client = TcpStream::connect(address).expect("connect to local API");
    client
        .set_read_timeout(Some(Duration::from_secs(2)))
        .expect("set socket read timeout");
    client.write_all(request.as_bytes()).expect("send request");
    let mut response = String::new();
    client.read_to_string(&mut response).expect("read response");
    response
}

#[test]
fn fixed_loopback_port_refuses_occupied_listener_without_fallback() {
    let _lock = FIXED_LOOPBACK_TEST_LOCK
        .get_or_init(|| Mutex::new(()))
        .lock()
        .expect("fixed loopback test lock");
    let occupied = bind_local_api_listener();
    let Ok(occupied) = occupied else {
        return;
    };
    let (_dir, app_data_dir) = data_directory();

    let result = start_local_api_with(app_data_dir, bind_local_api_listener);

    assert!(matches!(result, Err(LocalApiLifecycleError::Bind(_))));
    drop(occupied);
}

#[test]
fn generated_token_is_256_bit_hex() {
    let token = generate_token();

    assert_eq!(token.len(), 64);
    assert!(token.chars().all(|character| character.is_ascii_hexdigit()));
}
