use super::http_api_support::{
    call_router, format_auth, oversized_body, request_body, request_with, router, ApiOperation,
    LOCAL_HOST, TOKEN,
};
use axum::http::{Method, StatusCode};
use serde_json::Value;

#[test]
fn http_api_validation_returns_structured_error_for_malformed_json() {
    let app = router::build_router(TOKEN);
    let response = call_router(
        &app,
        request_with(
            Method::POST,
            "/v1/search_samples",
            Some(format_auth(TOKEN)),
            Some(LOCAL_HOST),
            Some("{not-json".to_string()),
            Some("application/json"),
            None,
        ),
    );
    assert_eq!(response.status, StatusCode::BAD_REQUEST);
    assert_eq!(
        response.payload,
        serde_json::json!({"request_id":"unknown","operation":"search_samples","code":"invalid_request","message":"body must be valid JSON payload","details":null})
    );
}

#[test]
fn http_api_validation_rejects_unknown_fields_through_todo_one_dto() {
    let app = router::build_router(TOKEN);
    let response = call_router(
        &app,
        request_with(
            Method::POST,
            "/v1/search_samples",
            Some(format_auth(TOKEN)),
            Some(LOCAL_HOST),
            Some(
                r#"{"request_id":"req_unknown","operation":"search_samples","unexpected":true}"#
                    .to_string(),
            ),
            Some("application/json"),
            None,
        ),
    );
    assert_eq!(response.status, StatusCode::BAD_REQUEST);
    assert_eq!(
        response.payload["request_id"],
        Value::String("req_unknown".into())
    );
    assert_eq!(
        response.payload["operation"],
        Value::String("search_samples".into())
    );
    assert_eq!(
        response.payload["code"],
        Value::String("invalid_request".into())
    );
}

#[test]
fn http_api_validation_rejects_invalid_content_oversize_and_uncontracted_fields() {
    let app = router::build_router(TOKEN);
    let content_type = call_router(
        &app,
        request_with(
            Method::POST,
            "/v1/search_samples",
            Some(format_auth(TOKEN)),
            Some(LOCAL_HOST),
            Some(request_body(ApiOperation::SearchSamples)),
            Some("text/plain"),
            None,
        ),
    );
    assert_eq!(content_type.status, StatusCode::BAD_REQUEST);

    let oversized = call_router(
        &app,
        request_with(
            Method::POST,
            "/v1/search_samples",
            Some(format_auth(TOKEN)),
            Some(LOCAL_HOST),
            Some(oversized_body()),
            Some("application/json"),
            None,
        ),
    );
    assert_eq!(oversized.status, StatusCode::PAYLOAD_TOO_LARGE);

    let uncontracted = call_router(&app, request_with(Method::POST, "/v1/search_samples", Some(format_auth(TOKEN)), Some(LOCAL_HOST), Some(r#"{"request_id":"req_internal","operation":"search_samples","force_internal_error":true}"#.to_string()), Some("application/json"), None));
    assert_eq!(uncontracted.status, StatusCode::BAD_REQUEST);
    assert_eq!(
        uncontracted.payload["code"],
        Value::String("invalid_request".into())
    );
}
