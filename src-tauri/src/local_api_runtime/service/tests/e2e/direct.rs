use super::support::{manager_with_samples, request, HttpRequest};
use crate::external_commands::{UiCommand, UiCommandQueue};
use crate::local_api_runtime::manifest::read_connection_manifest;
use crate::local_api_runtime::service::{start_local_api_with_manager, LocalApiDataDirectory};
use std::net::TcpListener;
use std::sync::{Arc, Mutex};
use tempfile::tempdir;

const HOST: &str = "127.0.0.1:37421";

#[test]
fn real_tcp_harness_preserves_contract_security_queue_and_collection_semantics() {
    // Given: an isolated database, data directory, and real TCP listener.
    let data_dir = tempdir().expect("temporary data directory");
    let database_dir = tempdir().expect("temporary database directory");
    let (manager, ids) = manager_with_samples(&database_dir.path().join("samples.db"));
    let listener = TcpListener::bind("127.0.0.1:0").expect("injected loopback listener");
    let address = listener.local_addr().expect("listener address");
    let manager = Arc::new(Mutex::new(manager));
    let queue = Arc::new(UiCommandQueue::with_capacity(8));
    let mut runtime = start_local_api_with_manager(
        LocalApiDataDirectory::new(data_dir.path().to_path_buf()),
        Arc::clone(&manager),
        Arc::clone(&queue),
        move || Ok(listener),
    )
    .expect("start local API");
    let manifest = read_connection_manifest(runtime.manifest_path())
        .expect("read manifest")
        .expect("published manifest");

    // When: every API operation crosses the actual TCP boundary before the renderer is ready.
    let search = call(
        address,
        &manifest.token,
        "/v1/search_samples",
        r#"{"request_id":"e2e-search","operation":"search_samples","instrument":"kick","bpm_min":120,"bpm_max":130,"limit":10}"#,
    );
    let get = call(
        address,
        &manifest.token,
        "/v1/get_sample",
        &format!(
            r#"{{"request_id":"e2e-get","operation":"get_sample","sample_id":{}}}"#,
            ids.source
        ),
    );
    let similar = call(
        address,
        &manifest.token,
        "/v1/find_similar_samples",
        &format!(
            r#"{{"request_id":"e2e-similar","operation":"find_similar_samples","sample_id":{},"limit":1,"exclude_duplicates":true}}"#,
            ids.source
        ),
    );
    let show = call(
        address,
        &manifest.token,
        "/v1/show_samples_in_app",
        &format!(
            r#"{{"request_id":"e2e-show","operation":"show_samples_in_app","sample_ids":[{},{}],"selected_id":{}}}"#,
            ids.similar, ids.source, ids.source
        ),
    );
    let preview = call(
        address,
        &manifest.token,
        "/v1/preview_sample",
        &format!(
            r#"{{"request_id":"e2e-preview","operation":"preview_sample","sample_id":{}}}"#,
            ids.source
        ),
    );
    let collection = collection_request(address, &manifest.token, ids.similar, ids.source);
    let repeated_collection = collection_request(address, &manifest.token, ids.similar, ids.source);

    // Then: structured search, redacted DTOs, ordered queue commands, and idempotent writes hold.
    assert_eq!(search.status, 200);
    assert_eq!(get.status, 200);
    assert_eq!(similar.status, 200);
    assert_eq!(show.status, 202);
    assert_eq!(preview.status, 202);
    assert_eq!(collection.status, 202);
    assert_eq!(repeated_collection.status, 202);
    let serialized_search = search.body.to_string();
    assert!(serialized_search.contains(&format!(r#""id":{}"#, ids.source)));
    assert!(!serialized_search.contains("embedding"));
    assert!(!serialized_search.contains("waveform_peaks"));
    assert_eq!(similar.body["matches"][0]["sample"]["id"], ids.similar);
    assert_eq!(collection.body["added_count"], 2);
    assert_eq!(collection.body["created"], true);
    assert_eq!(repeated_collection.body["added_count"], 0);
    assert_eq!(repeated_collection.body["created"], false);
    assert_eq!(
        queue
            .claim()
            .into_iter()
            .map(|lease| lease.command)
            .collect::<Vec<_>>(),
        vec![
            UiCommand::ShowSamples {
                sample_ids: vec![ids.similar, ids.source],
                selected_id: Some(ids.source)
            },
            UiCommand::PreviewSample {
                sample_id: ids.source
            },
            UiCommand::CollectionsChanged,
            UiCommand::CollectionsChanged,
        ],
    );

    runtime.shutdown();
    assert!(!runtime.manifest_path().exists());
}

#[test]
fn real_tcp_harness_rejects_bad_security_and_failure_inputs_without_cors() {
    // Given: a running API with a bounded one-entry durable queue.
    let data_dir = tempdir().expect("temporary data directory");
    let database_dir = tempdir().expect("temporary database directory");
    let (manager, ids) = manager_with_samples(&database_dir.path().join("samples.db"));
    let listener = TcpListener::bind("127.0.0.1:0").expect("injected loopback listener");
    let address = listener.local_addr().expect("listener address");
    let mut runtime = start_local_api_with_manager(
        LocalApiDataDirectory::new(data_dir.path().to_path_buf()),
        Arc::new(Mutex::new(manager)),
        Arc::new(UiCommandQueue::with_capacity(1)),
        move || Ok(listener),
    )
    .expect("start local API");
    let manifest = read_connection_manifest(runtime.manifest_path())
        .expect("read manifest")
        .expect("manifest");
    let search = r#"{"request_id":"e2e-failure","operation":"search_samples"}"#;

    // When: credentials, origin/host policy, a missing embedding, invalid collection, and full queue are exercised.
    let wrong_token = request(
        address,
        HttpRequest {
            token: "wrong",
            host: HOST,
            origin: None,
            path: "/v1/search_samples",
            body: search,
        },
    );
    let wrong_host = request(
        address,
        HttpRequest {
            token: &manifest.token,
            host: "localhost:37421",
            origin: None,
            path: "/v1/search_samples",
            body: search,
        },
    );
    let origin = request(
        address,
        HttpRequest {
            token: &manifest.token,
            host: HOST,
            origin: Some("null"),
            path: "/v1/search_samples",
            body: search,
        },
    );
    let missing_embedding = call(
        address,
        &manifest.token,
        "/v1/find_similar_samples",
        &format!(
            r#"{{"request_id":"e2e-missing","operation":"find_similar_samples","sample_id":{},"limit":1}}"#,
            ids.missing_embedding
        ),
    );
    let invalid_collection = call(
        address,
        &manifest.token,
        "/v1/add_to_collection",
        r#"{"request_id":"e2e-invalid","operation":"add_to_collection","collection_name":"bad","sample_ids":[999999]}"#,
    );
    let accepted = call(
        address,
        &manifest.token,
        "/v1/preview_sample",
        &format!(
            r#"{{"request_id":"e2e-accepted","operation":"preview_sample","sample_id":{}}}"#,
            ids.source
        ),
    );
    let queue_full = call(
        address,
        &manifest.token,
        "/v1/show_samples_in_app",
        &format!(
            r#"{{"request_id":"e2e-full","operation":"show_samples_in_app","sample_ids":[{}]}}"#,
            ids.source
        ),
    );

    // Then: every failure is contract-safe, no CORS headers appear, and the accepted lease survives.
    for response in [&wrong_token, &wrong_host, &origin] {
        assert!(!response
            .headers
            .to_ascii_lowercase()
            .contains("access-control-"));
    }
    assert_eq!(wrong_token.status, 401);
    assert_eq!(wrong_host.status, 400);
    assert_eq!(origin.status, 400);
    assert_eq!(missing_embedding.status, 409);
    assert_eq!(invalid_collection.status, 404);
    assert_eq!(accepted.status, 202);
    assert_eq!(queue_full.status, 503);

    runtime.shutdown();
}

fn call(
    address: std::net::SocketAddr,
    token: &str,
    path: &str,
    body: &str,
) -> super::support::HttpResponse {
    request(
        address,
        HttpRequest {
            token,
            host: HOST,
            origin: None,
            path,
            body,
        },
    )
}

fn collection_request(
    address: std::net::SocketAddr,
    token: &str,
    first_id: i64,
    second_id: i64,
) -> super::support::HttpResponse {
    call(
        address,
        token,
        "/v1/add_to_collection",
        &format!(
            r#"{{"request_id":"e2e-collection","operation":"add_to_collection","collection_name":"E2E","sample_ids":[{first_id},{second_id}]}}"#
        ),
    )
}
