use super::http_api_read_support::{
    call, request, seeded_router, seeded_router_with_queue_capacity_and_wake_callback,
};
use super::http_api_support::external_commands::{UiCommand, UiCommandQueue};
use axum::http::StatusCode;
use serde_json::json;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;

fn claim_commands(queue: &UiCommandQueue) -> Vec<UiCommand> {
    queue
        .claim()
        .into_iter()
        .map(|lease| lease.command)
        .collect()
}

#[test]
fn action_handlers_show_preserves_order_and_selects_first_when_unspecified() {
    // Given: two valid samples in a manager-backed router.
    let seeded = seeded_router();

    // When: the caller requests them in a non-database order without a selection.
    let (status, payload) = call(
        &seeded.app,
        request(
            "/v1/show_samples_in_app",
            json!({"request_id":"show-order","operation":"show_samples_in_app","sample_ids":[seeded.matching_id,seeded.source_id]}),
        ),
    );

    // Then: acceptance is asynchronous and the durable command has exact caller order.
    assert_eq!(status, StatusCode::ACCEPTED);
    assert_eq!(payload["requested_count"], json!(2));
    assert_eq!(payload["accepted_count"], json!(2));
    assert_eq!(
        claim_commands(&seeded.queue),
        vec![UiCommand::ShowSamples {
            sample_ids: vec![seeded.matching_id, seeded.source_id],
            selected_id: Some(seeded.matching_id),
        }]
    );
}

#[test]
fn action_handlers_show_samples_in_app_wakes_ui_on_success() {
    let wake_count = Arc::new(AtomicUsize::new(0));
    let wake_callback = {
        let wake_count = Arc::clone(&wake_count);
        std::sync::Arc::new(move || {
            wake_count.fetch_add(1, Ordering::SeqCst);
            true
        })
    };
    let seeded = seeded_router_with_queue_capacity_and_wake_callback(64, wake_callback);

    let (status, payload) = call(
        &seeded.app,
        request(
            "/v1/show_samples_in_app",
            json!({"request_id":"wake-success","operation":"show_samples_in_app","sample_ids":[seeded.matching_id,seeded.source_id]}),
        ),
    );

    assert_eq!(status, StatusCode::ACCEPTED);
    assert_eq!(payload["requested_count"], json!(2));
    assert_eq!(payload["accepted_count"], json!(2));
    assert_eq!(wake_count.load(Ordering::SeqCst), 1);
}

#[test]
fn action_handlers_show_samples_in_app_does_not_wake_ui_on_reject() {
    let wake_count = Arc::new(AtomicUsize::new(0));
    let wake_callback = {
        let wake_count = Arc::clone(&wake_count);
        std::sync::Arc::new(move || {
            wake_count.fetch_add(1, Ordering::SeqCst);
            true
        })
    };
    let seeded = seeded_router_with_queue_capacity_and_wake_callback(0, wake_callback);

    let (status, payload) = call(
        &seeded.app,
        request(
            "/v1/show_samples_in_app",
            json!({"request_id":"wake-reject","operation":"show_samples_in_app","sample_ids":[seeded.matching_id]}),
        ),
    );

    assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE);
    assert_eq!(payload["code"], json!("service_unavailable"));
    assert_eq!(wake_count.load(Ordering::SeqCst), 0);
}

#[test]
fn action_handlers_preview_queues_typed_selection_and_play_command() {
    // Given: a valid sample in a manager-backed router.
    let seeded = seeded_router();

    // When: a preview request targets that sample.
    let (status, payload) = call(
        &seeded.app,
        request(
            "/v1/preview_sample",
            json!({"request_id":"preview","operation":"preview_sample","sample_id":seeded.source_id}),
        ),
    );

    // Then: queue acceptance precedes the asynchronous success response.
    assert_eq!(status, StatusCode::ACCEPTED);
    assert_eq!(payload["accepted"], json!(true));
    assert_eq!(
        claim_commands(&seeded.queue),
        vec![UiCommand::PreviewSample {
            sample_id: seeded.source_id,
        }]
    );
}

#[test]
fn action_handlers_preview_sample_wakes_ui_on_success() {
    let wake_count = Arc::new(AtomicUsize::new(0));
    let wake_callback = {
        let wake_count = Arc::clone(&wake_count);
        std::sync::Arc::new(move || {
            wake_count.fetch_add(1, Ordering::SeqCst);
            true
        })
    };
    let seeded = seeded_router_with_queue_capacity_and_wake_callback(64, wake_callback);

    let (status, payload) = call(
        &seeded.app,
        request(
            "/v1/preview_sample",
            json!({"request_id":"preview-wake-success","operation":"preview_sample","sample_id":seeded.source_id}),
        ),
    );

    assert_eq!(status, StatusCode::ACCEPTED);
    assert_eq!(payload["accepted"], json!(true));
    assert_eq!(wake_count.load(Ordering::SeqCst), 1);
}

#[test]
fn action_handlers_preview_sample_does_not_wake_ui_when_queue_is_full() {
    let wake_count = Arc::new(AtomicUsize::new(0));
    let wake_callback = {
        let wake_count = Arc::clone(&wake_count);
        std::sync::Arc::new(move || {
            wake_count.fetch_add(1, Ordering::SeqCst);
            true
        })
    };
    let seeded = seeded_router_with_queue_capacity_and_wake_callback(0, wake_callback);

    let (status, payload) = call(
        &seeded.app,
        request(
            "/v1/preview_sample",
            json!({"request_id":"preview-wake-reject","operation":"preview_sample","sample_id":seeded.source_id}),
        ),
    );

    assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE);
    assert_eq!(payload["code"], json!("service_unavailable"));
    assert_eq!(wake_count.load(Ordering::SeqCst), 0);
}

#[test]
fn action_handlers_collection_is_atomic_idempotent_and_queues_after_persistence() {
    // Given: valid samples and an empty named collection.
    let seeded = seeded_router();
    let payload = json!({"request_id":"collection-first","operation":"add_to_collection","collection_name":"  Studio  Drums ","sample_ids":[seeded.matching_id,seeded.source_id]});

    // When: the same external batch is added twice.
    let (first_status, first) = call(&seeded.app, request("/v1/add_to_collection", payload));
    let (second_status, second) = call(
        &seeded.app,
        request(
            "/v1/add_to_collection",
            json!({"request_id":"collection-second","operation":"add_to_collection","collection_name":"studio drums","sample_ids":[seeded.matching_id,seeded.source_id]}),
        ),
    );

    // Then: first-use creation, idempotence, persistence, and post-persistence notifications agree.
    assert_eq!(first_status, StatusCode::ACCEPTED);
    assert_eq!(first["created"], json!(true));
    assert_eq!(first["added_count"], json!(2));
    assert_eq!(second_status, StatusCode::ACCEPTED);
    assert_eq!(second["created"], json!(false));
    assert_eq!(second["added_count"], json!(0));
    let manager = seeded.manager.lock().expect("manager lock");
    let collections = manager.list_collections().expect("collections");
    assert_eq!(collections.len(), 1);
    assert_eq!(
        manager
            .list_collection_member_sample_ids(collections[0].id)
            .expect("collection members"),
        vec![seeded.matching_id, seeded.source_id]
    );
    drop(manager);
    assert_eq!(
        claim_commands(&seeded.queue),
        vec![UiCommand::CollectionsChanged, UiCommand::CollectionsChanged]
    );
}

#[test]
fn action_handlers_add_to_collection_wakes_ui_on_success() {
    let wake_count = Arc::new(AtomicUsize::new(0));
    let wake_callback = {
        let wake_count = Arc::clone(&wake_count);
        std::sync::Arc::new(move || {
            wake_count.fetch_add(1, Ordering::SeqCst);
            true
        })
    };
    let seeded = seeded_router_with_queue_capacity_and_wake_callback(64, wake_callback);

    let (status, payload) = call(
        &seeded.app,
        request(
            "/v1/add_to_collection",
            json!({"request_id":"collection-wake-success","operation":"add_to_collection","collection_name":"Studio","sample_ids":[seeded.matching_id,seeded.source_id]}),
        ),
    );

    assert_eq!(status, StatusCode::ACCEPTED);
    assert_eq!(payload["created"], json!(true));
    assert_eq!(wake_count.load(Ordering::SeqCst), 1);
}

#[test]
fn action_handlers_reject_missing_ids_and_full_queue_without_side_effects() {
    // Given: a zero-capacity durable queue and one valid sample.
    let wake_count = Arc::new(AtomicUsize::new(0));
    let wake_callback = {
        let wake_count = Arc::clone(&wake_count);
        std::sync::Arc::new(move || {
            wake_count.fetch_add(1, Ordering::SeqCst);
            true
        })
    };
    let seeded = seeded_router_with_queue_capacity_and_wake_callback(0, wake_callback);

    // When: the valid request cannot reserve a queue entry, then a mixed-ID batch is submitted.
    let (full_status, full) = call(
        &seeded.app,
        request(
            "/v1/add_to_collection",
            json!({"request_id":"queue-full","operation":"add_to_collection","collection_name":"blocked","sample_ids":[seeded.source_id]}),
        ),
    );
    let (missing_status, missing) = call(
        &seeded.app,
        request(
            "/v1/add_to_collection",
            json!({"request_id":"missing","operation":"add_to_collection","collection_name":"missing","sample_ids":[seeded.source_id,9999]}),
        ),
    );

    // Then: no collection or notification survives either rejected operation.
    assert_eq!(full_status, StatusCode::SERVICE_UNAVAILABLE);
    assert_eq!(full["code"], json!("service_unavailable"));
    assert_eq!(missing_status, StatusCode::NOT_FOUND);
    assert_eq!(missing["code"], json!("not_found"));
    assert_eq!(wake_count.load(Ordering::SeqCst), 0);
    assert!(seeded
        .manager
        .lock()
        .expect("manager lock")
        .list_collections()
        .expect("collections")
        .is_empty());
    assert!(seeded.queue.claim().is_empty());
}

#[test]
fn action_handlers_reject_missing_preview_without_queueing() {
    let wake_count = Arc::new(AtomicUsize::new(0));
    let wake_callback = {
        let wake_count = Arc::clone(&wake_count);
        std::sync::Arc::new(move || {
            wake_count.fetch_add(1, Ordering::SeqCst);
            true
        })
    };
    let seeded = seeded_router_with_queue_capacity_and_wake_callback(64, wake_callback);

    // When: preview references an absent ID.
    let (status, payload) = call(
        &seeded.app,
        request(
            "/v1/preview_sample",
            json!({"request_id":"missing-preview","operation":"preview_sample","sample_id":9999}),
        ),
    );

    // Then: the request is rejected without an action.
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(payload["code"], json!("not_found"));
    assert_eq!(wake_count.load(Ordering::SeqCst), 0);
    assert!(seeded.queue.claim().is_empty());
}
