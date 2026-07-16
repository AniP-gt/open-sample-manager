use super::http_api_support::{
    assert_no_cors_headers, call_router, format_auth, request_body, request_with, router,
    ApiOperation, LOCAL_HOST, TOKEN,
};
use axum::http::{header, Method, StatusCode};
use serde_json::Value;

#[test]
fn http_api_auth_rejects_missing_token_with_www_authenticate() {
    let app = router::build_router(TOKEN);
    let response = call_router(
        &app,
        request_with(
            Method::POST,
            "/v1/search_samples",
            None,
            Some(LOCAL_HOST),
            Some(request_body(ApiOperation::SearchSamples)),
            Some("application/json"),
            None,
        ),
    );

    assert_eq!(response.status, StatusCode::UNAUTHORIZED);
    assert_no_cors_headers(&response.headers);
    assert_eq!(
        response.payload["code"],
        Value::String("unauthorized".into())
    );
    assert_eq!(response.headers[header::WWW_AUTHENTICATE], "Bearer");
}

#[test]
fn http_api_auth_rejects_wrong_or_malformed_bearer_token() {
    let app = router::build_router(TOKEN);
    for authorization in [
        "Basic wrong-token".to_string(),
        format_auth("totally-wrong-token"),
    ] {
        let response = call_router(
            &app,
            request_with(
                Method::POST,
                "/v1/search_samples",
                Some(authorization),
                Some(LOCAL_HOST),
                Some(request_body(ApiOperation::SearchSamples)),
                Some("application/json"),
                None,
            ),
        );
        assert_eq!(response.status, StatusCode::UNAUTHORIZED);
        assert_eq!(
            response.payload["code"],
            Value::String("unauthorized".into())
        );
    }
}

#[test]
fn http_api_auth_rejects_bad_host_origin_and_duplicate_host() {
    let app = router::build_router(TOKEN);
    let bad_host = call_router(
        &app,
        request_with(
            Method::POST,
            "/v1/search_samples",
            Some(format_auth(TOKEN)),
            Some("localhost:37421"),
            Some(request_body(ApiOperation::SearchSamples)),
            Some("application/json"),
            None,
        ),
    );
    assert_eq!(bad_host.status, StatusCode::BAD_REQUEST);

    let bad_origin = call_router(
        &app,
        request_with(
            Method::POST,
            "/v1/search_samples",
            Some(format_auth(TOKEN)),
            Some(LOCAL_HOST),
            Some(request_body(ApiOperation::SearchSamples)),
            Some("application/json"),
            Some("null"),
        ),
    );
    assert_eq!(bad_origin.status, StatusCode::BAD_REQUEST);

    let mut duplicate_host = request_with(
        Method::POST,
        "/v1/search_samples",
        Some(format_auth(TOKEN)),
        Some(LOCAL_HOST),
        Some(request_body(ApiOperation::SearchSamples)),
        Some("application/json"),
        None,
    );
    duplicate_host
        .headers_mut()
        .append(header::HOST, header::HeaderValue::from_static(LOCAL_HOST));
    let response = call_router(&app, duplicate_host);
    assert_eq!(response.status, StatusCode::BAD_REQUEST);
    assert_eq!(
        response.payload["request_id"],
        Value::String("unknown".into())
    );
    assert_eq!(
        response.payload["code"],
        Value::String("invalid_request".into())
    );
}

#[test]
fn http_api_auth_requires_authentication_for_options_and_unknown_routes() {
    let app = router::build_router(TOKEN);
    for (method, path) in [
        (Method::OPTIONS, "/v1/search_samples"),
        (Method::POST, "/v1/unknown"),
    ] {
        let response = call_router(
            &app,
            request_with(method, path, None, Some(LOCAL_HOST), None, None, None),
        );
        assert_eq!(response.status, StatusCode::UNAUTHORIZED);
        assert_eq!(
            response.payload["code"],
            Value::String("unauthorized".into())
        );
    }
}

#[test]
fn http_api_auth_returns_exact_method_error_envelope_after_authentication() {
    let app = router::build_router(TOKEN);
    for method in [Method::GET, Method::OPTIONS] {
        let response = call_router(
            &app,
            request_with(
                method,
                "/v1/search_samples",
                Some(format_auth(TOKEN)),
                Some(LOCAL_HOST),
                None,
                None,
                None,
            ),
        );
        assert_eq!(response.status, StatusCode::METHOD_NOT_ALLOWED);
        assert_eq!(
            response.payload,
            serde_json::json!({"request_id":"unknown","operation":"search_samples","code":"invalid_request","message":"method is not allowed","details":null})
        );
    }
}
