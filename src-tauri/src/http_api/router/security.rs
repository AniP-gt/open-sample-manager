use axum::{
    body::Body,
    http::{header, HeaderValue, Request, StatusCode},
    middleware::Next,
    response::Response,
};

use crate::http_api::{
    auth::is_valid_bearer_token,
    contracts::{ApiError, ApiOperation},
};

use super::{
    response::{api_error_response, api_error_response_with_status, operation_for_path},
    LOCALHOST_API_HOST,
};

pub(crate) async fn enforce_http_api_security(
    request: Request<Body>,
    next: Next,
    token: String,
) -> Response {
    let path = request.uri().path();
    let operation = operation_for_path(path);

    if request.headers().contains_key(header::ORIGIN) {
        return api_error_response(ApiError::invalid_request(
            "unknown",
            ApiOperation::SearchSamples,
            "origin header is not allowed",
        ));
    }

    let hosts = request.headers().get_all(header::HOST);
    let host = hosts
        .iter()
        .next()
        .and_then(|value| value.to_str().ok())
        .unwrap_or("");

    if hosts.iter().count() != 1
        || host.is_empty()
        || host.contains(',')
        || host != LOCALHOST_API_HOST
    {
        return api_error_response(ApiError::invalid_request(
            "unknown",
            ApiOperation::SearchSamples,
            "host must be 127.0.0.1:37421",
        ));
    }

    let auth_header = request
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok());

    if !is_valid_bearer_token(auth_header, &token) {
        let mut response = api_error_response(ApiError::unauthorized(
            "unknown",
            ApiOperation::SearchSamples,
            "missing or invalid bearer token",
        ));
        response
            .headers_mut()
            .insert(header::WWW_AUTHENTICATE, HeaderValue::from_static("Bearer"));
        return response;
    }

    let response = next.run(request).await;
    if response.status() == StatusCode::METHOD_NOT_ALLOWED {
        return api_error_response_with_status(
            ApiError::invalid_request("unknown", operation, "method is not allowed"),
            StatusCode::METHOD_NOT_ALLOWED,
        );
    }

    response
}
