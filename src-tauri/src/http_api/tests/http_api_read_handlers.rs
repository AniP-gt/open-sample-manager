use std::{
    panic::{self, AssertUnwindSafe},
    sync::{Arc, Mutex},
};

use super::http_api_read_support::{call, in_memory_router, request, seeded_router};
use super::http_api_support::{router, TOKEN};
use axum::http::StatusCode;
use open_sample_manager_core::SampleManager;
use serde_json::{json, Value};
use tower::ServiceExt;

#[test]
fn read_handlers_search_structured_filters_pagination_and_redaction() {
    // Given: seeded kick samples whose public responses contain internal source fields.
    let seeded = seeded_router();
    // When: structured filters request one result.
    let (status, payload) = call(
        &seeded.app,
        request(
            "/v1/search_samples",
            json!({"request_id":"read-search","operation":"search_samples","query":"source","sample_type":"one-shot","instrument":"kick","bpm_min":120.0,"bpm_max":130.0,"key":"C","tags":["drums","metal"],"directory_path":"/library","limit":1,"offset":0}),
        ),
    );
    // Then: pagination is preserved and binary internal fields are absent.
    assert_eq!(status, StatusCode::OK);
    assert_eq!(payload["results"].as_array().map(Vec::len), Some(1));
    assert_eq!(payload["has_more"], Value::Bool(false));
    assert_eq!(payload["results"][0]["id"], json!(seeded.source_id));
    assert!(payload["results"][0].get("embedding").is_none());
    assert!(payload["results"][0].get("waveform_peaks").is_none());
}

#[test]
fn read_handlers_search_paginates_by_stable_manager_order() {
    // Given: stored samples with IDs assigned in seed insertion order.
    let seeded = seeded_router();

    // When: the second row is requested with a one-row page.
    let (status, payload) = call(
        &seeded.app,
        request(
            "/v1/search_samples",
            json!({"request_id":"read-page","operation":"search_samples","limit":1,"offset":1}),
        ),
    );

    // Then: the manager order is preserved and the following page is advertised.
    assert_eq!(status, StatusCode::OK);
    assert_eq!(payload["results"][0]["id"], json!(seeded.duplicate_id));
    assert_eq!(payload["has_more"], Value::Bool(true));
}

#[test]
fn read_handlers_get_sample_returns_redacted_dto() {
    // Given: a stored sample containing embedding and waveform payloads.
    let seeded = seeded_router();

    // When: the sample is requested by ID through the HTTP router.
    let (status, payload) = call(
        &seeded.app,
        request(
            "/v1/get_sample",
            json!({"request_id":"read-get","operation":"get_sample","sample_id":seeded.source_id}),
        ),
    );

    // Then: the typed response contains the sample ID without binary internal fields.
    assert_eq!(status, StatusCode::OK);
    assert_eq!(payload["sample"]["id"], json!(seeded.source_id));
    assert!(payload["sample"].get("embedding").is_none());
    assert!(payload["sample"].get("waveform_peaks").is_none());
}

#[test]
fn read_handlers_similar_samples_preserve_similarity_order() {
    // Given: a source with duplicate and non-duplicate embedding matches.
    let seeded = seeded_router();

    // When: similarity search keeps duplicates and requests two matches.
    let (status, payload) = call(
        &seeded.app,
        request(
            "/v1/find_similar_samples",
            json!({"request_id":"read-similar-order","operation":"find_similar_samples","sample_id":seeded.source_id,"limit":2,"exclude_duplicates":false}),
        ),
    );

    // Then: the source is excluded and remaining rows stay in descending similarity order.
    assert_eq!(status, StatusCode::OK);
    assert_eq!(
        payload["matches"][0]["sample"]["id"],
        json!(seeded.duplicate_id)
    );
    assert_eq!(
        payload["matches"][1]["sample"]["id"],
        json!(seeded.matching_id)
    );
    let first_similarity = payload["matches"][0]["similarity"]
        .as_f64()
        .expect("first similarity");
    let second_similarity = payload["matches"][1]["similarity"]
        .as_f64()
        .expect("second similarity");
    assert!(first_similarity > second_similarity);
}

#[test]
fn read_handlers_similar_samples_report_missing_source_as_not_found() {
    // Given: an empty manager-backed router.
    let app = in_memory_router();

    // When: similarity search names an absent source ID.
    let (status, payload) = call(
        &app,
        request(
            "/v1/find_similar_samples",
            json!({"request_id":"missing-similar","operation":"find_similar_samples","sample_id":9999,"limit":1}),
        ),
    );

    // Then: the safe contract reports the typed missing-resource error.
    assert_eq!(status, StatusCode::NOT_FOUND);
    assert_eq!(payload["code"], "not_found");
}

#[test]
fn read_handlers_report_safe_missing_embedding_and_malformed_search_errors() {
    // Given: a source, duplicate, match, no-embedding row, and in-memory manager.
    let seeded = seeded_router();
    let memory_router = in_memory_router();
    // When: lookup, duplicate-excluding similarity, absent embedding, malformed field, and absent ID are requested.
    let (similar_status, similar) = call(
        &seeded.app,
        request(
            "/v1/find_similar_samples",
            json!({"request_id":"read-similar","operation":"find_similar_samples","sample_id":seeded.source_id,"limit":2,"exclude_duplicates":true}),
        ),
    );
    let (embedding_status, embedding) = call(
        &seeded.app,
        request(
            "/v1/find_similar_samples",
            json!({"request_id":"read-empty","operation":"find_similar_samples","sample_id":seeded.no_embedding_id,"limit":1}),
        ),
    );
    let (malformed_status, malformed) = call(
        &seeded.app,
        request(
            "/v1/search_samples",
            json!({"request_id":"bad-search","operation":"search_samples","instrument":"kick\" tag:other"}),
        ),
    );
    let (missing_status, missing) = call(
        &memory_router,
        request(
            "/v1/get_sample",
            json!({"request_id":"read-missing","operation":"get_sample","sample_id":9999}),
        ),
    );
    // Then: source/duplicates do not leak into results and errors are safe contract responses.
    assert_eq!(similar_status, StatusCode::OK);
    assert!(similar["matches"]
        .as_array()
        .expect("matches")
        .iter()
        .all(|match_| match_["sample"]["id"] != json!(seeded.source_id)
            && match_["sample"]["id"] != json!(seeded.duplicate_id)));
    assert_eq!(
        similar["matches"][0]["sample"]["id"],
        json!(seeded.matching_id)
    );
    assert_eq!(embedding_status, StatusCode::CONFLICT);
    assert_eq!(embedding["code"], "duplicate");
    assert_eq!(malformed_status, StatusCode::BAD_REQUEST);
    assert_eq!(malformed["code"], "invalid_request");
    assert_eq!(missing_status, StatusCode::NOT_FOUND);
    assert_eq!(missing["code"], "not_found");
}

#[test]
fn read_handlers_release_manager_lock_between_concurrent_requests() {
    // Given: one manager-backed router with a source sample.
    let seeded = seeded_router();
    let first = request(
        "/v1/get_sample",
        json!({"request_id":"concurrent-a","operation":"get_sample","sample_id":seeded.source_id}),
    );
    let second = request(
        "/v1/get_sample",
        json!({"request_id":"concurrent-b","operation":"get_sample","sample_id":seeded.source_id}),
    );
    let runtime = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .expect("test runtime");
    // When: two requests await manager work concurrently.
    let (first, second) = runtime.block_on(async {
        tokio::join!(
            seeded.app.clone().oneshot(first),
            seeded.app.clone().oneshot(second)
        )
    });
    // Then: both responses complete after their blocking mutex scopes end.
    assert_eq!(first.expect("first response").status(), StatusCode::OK);
    assert_eq!(second.expect("second response").status(), StatusCode::OK);
}

#[test]
fn read_handlers_return_service_unavailable_when_manager_lock_is_poisoned() {
    // Given: a shared manager whose mutex was poisoned by an interrupted prior request.
    let manager = Arc::new(Mutex::new(
        SampleManager::new(None).expect("in-memory manager"),
    ));
    let poisoned_manager = Arc::clone(&manager);
    let _ = panic::catch_unwind(AssertUnwindSafe(move || {
        let _guard = poisoned_manager.lock().expect("manager lock");
        panic!("poison the manager lock for this test");
    }));
    let app = router::build_router_with_manager(TOKEN, manager);

    // When: a read endpoint attempts to access the unavailable manager.
    let (status, payload) = call(
        &app,
        request(
            "/v1/get_sample",
            json!({"request_id":"poisoned-manager","operation":"get_sample","sample_id":1}),
        ),
    );

    // Then: the contract exposes a safe retryable error rather than an internal failure.
    assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE);
    assert_eq!(payload["code"], "service_unavailable");
    assert_eq!(payload["message"], "sample lookup is unavailable");
}
