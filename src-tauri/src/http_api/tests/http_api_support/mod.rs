pub(super) use crate::external_commands;
use crate::http_api::contracts;
pub(super) use crate::http_api::router;

use std::{fs, path::PathBuf};

use axum::{
    body::{to_bytes, Body},
    http::{header, HeaderMap, Method, Request, StatusCode},
    Router,
};
use contracts::{
    AddToCollectionRequest, ApiRequest, FindSimilarSamplesRequest, GetSampleRequest,
    PreviewSampleRequest, SearchSamplesRequest, ShowSamplesInAppRequest,
};
use serde::{de::DeserializeOwned, Serialize};
use serde_json::Value;
use tower::ServiceExt;

pub use contracts::ApiOperation;

pub const TOKEN: &str = "local-test-token";
pub const LOCAL_HOST: &str = "127.0.0.1:37421";

#[derive(Debug)]
pub struct ResponseCapture {
    pub status: StatusCode,
    pub headers: HeaderMap,
    pub payload: Value,
}

pub fn format_auth(token: &str) -> String {
    format!("Bearer {token}")
}

pub fn request_with(
    method: Method,
    path: &str,
    authorization: Option<String>,
    host: Option<&str>,
    body: Option<String>,
    content_type: Option<&str>,
    origin: Option<&str>,
) -> Request<Body> {
    let mut request = Request::builder()
        .method(method)
        .uri(path)
        .body(Body::from(body.unwrap_or_default()))
        .expect("request should build");

    if let Some(host) = host {
        request.headers_mut().insert(
            header::HOST,
            header::HeaderValue::from_str(host).expect("valid host"),
        );
    }
    if let Some(authorization) = authorization {
        request.headers_mut().insert(
            header::AUTHORIZATION,
            header::HeaderValue::from_str(&authorization).expect("valid auth"),
        );
    }
    if let Some(content_type) = content_type {
        request.headers_mut().insert(
            header::CONTENT_TYPE,
            header::HeaderValue::from_str(content_type).expect("valid content type"),
        );
    }
    if let Some(origin) = origin {
        request.headers_mut().insert(
            header::ORIGIN,
            header::HeaderValue::from_str(origin).expect("valid origin"),
        );
    }
    request
}

pub fn request_body(operation: ApiOperation) -> String {
    match operation {
        ApiOperation::SearchSamples => {
            typed_request_body::<SearchSamplesRequest>("requests/search_samples.json")
        }
        ApiOperation::GetSample => {
            typed_request_body::<GetSampleRequest>("requests/get_sample.json")
        }
        ApiOperation::FindSimilarSamples => {
            typed_request_body::<FindSimilarSamplesRequest>("requests/find_similar_samples.json")
        }
        ApiOperation::ShowSamplesInApp => {
            typed_request_body::<ShowSamplesInAppRequest>("requests/show_samples_in_app.json")
        }
        ApiOperation::PreviewSample => {
            typed_request_body::<PreviewSampleRequest>("requests/preview_sample.json")
        }
        ApiOperation::AddToCollection => {
            typed_request_body::<AddToCollectionRequest>("requests/add_to_collection.json")
        }
        ApiOperation::ListInstrumentTypes => r#"{"request_id":"req_list_inst","operation":"list_instrument_types"}"#.to_string(),
        ApiOperation::CreateInstrumentType => r#"{"request_id":"req_create_inst","operation":"create_instrument_type","name":"guitar"}"#.to_string(),
        ApiOperation::UpdateSampleInstruments => r#"{"request_id":"req_update_inst","operation":"update_sample_instruments","assignments":[{"sample_id":1,"instrument_type":"guitar"}]}"#.to_string(),
    }
}

fn typed_request_body<T>(relative: &str) -> String
where
    T: for<'de> DeserializeOwned + Serialize,
{
    let raw = fixture(relative);
    let parsed = serde_json::from_str::<ApiRequest<T>>(&raw).expect("fixture should parse");
    serde_json::to_string(&parsed).expect("fixture should serialize")
}

pub fn request_id_from_body(body: &str) -> String {
    let value: Value = serde_json::from_str(body).expect("payload should be valid json");
    value
        .get("request_id")
        .and_then(Value::as_str)
        .expect("request_id exists in payload")
        .to_string()
}

fn fixture(relative: &str) -> String {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("contracts/localhost-api-mcp/fixtures")
        .join(relative);
    fs::read_to_string(path).expect("fixture exists")
}

pub fn oversized_body() -> String {
    let mut payload = serde_json::Map::new();
    payload.insert("request_id".into(), Value::String("req_overflow".into()));
    payload.insert(
        "operation".into(),
        Value::String(ApiOperation::SearchSamples.as_str().into()),
    );
    payload.insert(
        "query".into(),
        Value::String("x".repeat(router::MAX_JSON_BODY_BYTES + 1)),
    );

    Value::Object(payload).to_string()
}

pub fn call_router(app: &Router<()>, request: Request<Body>) -> ResponseCapture {
    let runtime = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .expect("runtime");

    let (status, headers, payload) = runtime.block_on(async {
        let response = app
            .clone()
            .oneshot(request)
            .await
            .expect("router call should succeed");
        let status = response.status();
        let headers = response.headers().clone();
        let bytes = to_bytes(response.into_body(), router::MAX_JSON_BODY_BYTES + 1)
            .await
            .unwrap_or_default();
        let payload = serde_json::from_slice(&bytes).unwrap_or(Value::Null);
        (status, headers, payload)
    });

    ResponseCapture {
        status,
        headers,
        payload,
    }
}

pub fn assert_no_cors_headers(headers: &HeaderMap) {
    assert!(headers.get("access-control-allow-origin").is_none());
    assert!(headers.get("access-control-allow-methods").is_none());
    assert!(headers.get("access-control-allow-headers").is_none());
}
