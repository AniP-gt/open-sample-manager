use axum::{
    body::{to_bytes, Body},
    http::{header, HeaderMap, Request},
    response::Response,
};
use serde::de::DeserializeOwned;
use serde_json::Value;

use crate::http_api::{
    contracts::{ApiError, ApiOperation, ApiRequest},
    validation::validate_todo_one_request,
};

use super::{response::api_error_response, MAX_JSON_BODY_BYTES};

#[cfg(test)]
use axum::{http::StatusCode, response::IntoResponse, Json};

#[cfg(test)]
#[derive(serde::Serialize)]
struct StubSuccessResponse<'a> {
    request_id: &'a str,
    operation: &'a str,
    accepted: bool,
}

#[cfg(test)]
#[derive(Clone)]
struct ParsedRequest {
    request_id: String,
    operation: ApiOperation,
}

#[cfg(test)]
pub(crate) async fn route_stub_handler(
    request: Request<Body>,
    expected_operation: ApiOperation,
) -> Response {
    let request_body = match parse_request_body(request, expected_operation).await {
        Ok(request_body) => request_body,
        Err(response) => return response,
    };

    let response = StubSuccessResponse {
        request_id: &request_body.request_id,
        operation: request_body.operation.as_str(),
        accepted: true,
    };

    (StatusCode::OK, Json(response)).into_response()
}

#[cfg(test)]
async fn parse_request_body(
    request: Request<Body>,
    expected_operation: ApiOperation,
) -> Result<ParsedRequest, Response> {
    let (request_id, _) = parse_request_bytes(request, expected_operation).await?;

    Ok(ParsedRequest {
        request_id,
        operation: expected_operation,
    })
}

pub(crate) async fn parse_typed_request<T>(
    request: Request<Body>,
    expected_operation: ApiOperation,
) -> Result<ApiRequest<T>, Response>
where
    T: DeserializeOwned,
{
    let (request_id, bytes) = parse_request_bytes(request, expected_operation).await?;
    serde_json::from_slice(&bytes).map_err(|_| {
        api_error_response(ApiError::invalid_request(
            &request_id,
            expected_operation,
            "body must match request contract",
        ))
    })
}

async fn parse_request_bytes(
    request: Request<Body>,
    expected_operation: ApiOperation,
) -> Result<(String, Vec<u8>), Response> {
    if !is_json_content_type(request.headers()) {
        return Err(api_error_response(ApiError::invalid_request(
            "unknown",
            expected_operation,
            "content-type must be application/json",
        )));
    }

    let bytes = to_bytes(request.into_body(), MAX_JSON_BODY_BYTES + 1)
        .await
        .map_err(|_| {
            api_error_response(ApiError::payload_too_large(
                "unknown",
                expected_operation,
                "request body exceeds 64KiB",
            ))
        })?;

    if bytes.len() > MAX_JSON_BODY_BYTES {
        return Err(api_error_response(ApiError::payload_too_large(
            "unknown",
            expected_operation,
            "request body exceeds 64KiB",
        )));
    }

    let payload: Value = serde_json::from_slice(&bytes).map_err(|_| {
        api_error_response(ApiError::invalid_request(
            "unknown",
            expected_operation,
            "body must be valid JSON payload",
        ))
    })?;

    let request_id = payload
        .get("request_id")
        .and_then(Value::as_str)
        .filter(|id| !id.trim().is_empty())
        .ok_or_else(|| {
            api_error_response(ApiError::invalid_request(
                "unknown",
                expected_operation,
                "missing request_id",
            ))
        })?
        .to_string();

    validate_todo_one_request(&bytes, &request_id, expected_operation)
        .map_err(api_error_response)?;

    Ok((request_id, bytes.to_vec()))
}

fn is_json_content_type(headers: &HeaderMap) -> bool {
    headers
        .get(header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .is_some_and(|value| {
            let normalized = value.to_ascii_lowercase();
            normalized == "application/json" || normalized.starts_with("application/json;")
        })
}
