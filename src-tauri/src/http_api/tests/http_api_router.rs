use super::http_api_support::{
    assert_no_cors_headers, call_router, format_auth, request_body, request_id_from_body,
    request_with, router, ApiOperation, LOCAL_HOST, TOKEN,
};
use axum::http::{Method, StatusCode};
use serde_json::Value;

#[test]
fn http_api_router_accepts_all_valid_post_routes_without_bypassing_security() {
    let app = router::build_router(TOKEN);
    for (operation, path) in [
        (ApiOperation::SearchSamples, "/v1/search_samples"),
        (ApiOperation::GetSample, "/v1/get_sample"),
        (ApiOperation::FindSimilarSamples, "/v1/find_similar_samples"),
        (ApiOperation::ShowSamplesInApp, "/v1/show_samples_in_app"),
        (ApiOperation::PreviewSample, "/v1/preview_sample"),
        (ApiOperation::AddToCollection, "/v1/add_to_collection"),
        (
            ApiOperation::ListInstrumentTypes,
            "/v1/list_instrument_types",
        ),
        (
            ApiOperation::CreateInstrumentType,
            "/v1/create_instrument_type",
        ),
        (
            ApiOperation::UpdateSampleInstruments,
            "/v1/update_sample_instruments",
        ),
    ] {
        let body = request_body(operation);
        let response = call_router(
            &app,
            request_with(
                Method::POST,
                path,
                Some(format_auth(TOKEN)),
                Some(LOCAL_HOST),
                Some(body.clone()),
                Some("application/json"),
                None,
            ),
        );
        assert_eq!(response.status, StatusCode::OK, "{operation:?}");
        assert_no_cors_headers(&response.headers);
        assert_eq!(
            response.payload["request_id"],
            Value::String(request_id_from_body(&body))
        );
        assert_eq!(
            response.payload["operation"],
            Value::String(operation.as_str().to_string())
        );
        assert_eq!(response.payload["accepted"], Value::Bool(true));
    }
}

#[test]
fn http_api_router_rejects_unknown_routes_and_operation_mismatch() {
    let app = router::build_router(TOKEN);
    let missing = call_router(
        &app,
        request_with(
            Method::POST,
            "/v1/does-not-exist",
            Some(format_auth(TOKEN)),
            Some(LOCAL_HOST),
            Some(request_body(ApiOperation::SearchSamples)),
            Some("application/json"),
            None,
        ),
    );
    assert_eq!(missing.status, StatusCode::NOT_FOUND);

    let mismatch = call_router(
        &app,
        request_with(
            Method::POST,
            "/v1/search_samples",
            Some(format_auth(TOKEN)),
            Some(LOCAL_HOST),
            Some(
                r#"{"request_id":"req_mismatch","operation":"get_sample","sample_id":1}"#
                    .to_string(),
            ),
            Some("application/json"),
            None,
        ),
    );
    assert_eq!(mismatch.status, StatusCode::BAD_REQUEST);
    assert_eq!(
        mismatch.payload["code"],
        Value::String("invalid_request".into())
    );
}
