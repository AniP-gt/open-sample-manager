use crate::http_api::contracts::{ApiError, ApiOperation, ApiRequest, SearchSamplesRequest};
use crate::http_api::errors::ErrorCode;
use crate::http_api::requests::ALLOWED_OPERATIONS;

#[test]
fn local_api_contract_freezes_the_exact_six_operations() {
    let names = ALLOWED_OPERATIONS.map(ApiOperation::as_str);
    assert_eq!(
        names,
        [
            "search_samples",
            "get_sample",
            "find_similar_samples",
            "show_samples_in_app",
            "preview_sample",
            "add_to_collection",
        ]
    );
}

#[test]
fn local_api_contract_rejects_unknown_search_fields() {
    let raw = r#"{
        "request_id":"req_contract_001",
        "operation":"search_samples",
        "query":"kick",
        "unexpected":true
    }"#;

    assert!(serde_json::from_str::<ApiRequest<SearchSamplesRequest>>(raw).is_err());
}

#[test]
fn local_api_contract_maps_required_safe_error_statuses() {
    let statuses = [
        (ErrorCode::InvalidRequest, 400),
        (ErrorCode::Unauthorized, 401),
        (ErrorCode::Forbidden, 403),
        (ErrorCode::NotFound, 404),
        (ErrorCode::Duplicate, 409),
        (ErrorCode::PayloadTooLarge, 413),
        (ErrorCode::ServiceUnavailable, 503),
        (ErrorCode::InternalError, 500),
    ];
    for (code, status) in statuses {
        assert_eq!(code.http_status(), status);
    }
}

#[test]
fn local_api_contract_builds_safe_common_error_envelopes() {
    let constructors: [fn(&str, ApiOperation, &str) -> ApiError; 8] = [
        ApiError::invalid_request,
        ApiError::unauthorized,
        ApiError::forbidden,
        ApiError::not_found,
        ApiError::duplicate,
        ApiError::payload_too_large,
        ApiError::service_unavailable,
        ApiError::internal_error,
    ];
    for build in constructors {
        let error = build(
            "req_contract_001",
            ApiOperation::SearchSamples,
            "safe message",
        );
        assert_eq!(error.request_id, "req_contract_001");
        assert_eq!(error.operation, ApiOperation::SearchSamples);
        assert_eq!(error.message, "safe message");
        assert!(error.details.is_none());
    }
}
