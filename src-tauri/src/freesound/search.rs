use std::time::Duration;

use super::{
    read_credential, response::SearchBody, FreesoundApiError, FreesoundApiKey,
    FreesoundSearchResponse,
};
use futures_util::StreamExt;
use reqwest::{header::AUTHORIZATION, redirect::Policy};

const API_SEARCH_URL: &str = "https://freesound.org/apiv2/search/";
const PAGE_SIZE: u8 = 20;
const MAX_PAGE: u32 = 1_000;
const MAX_QUERY_LENGTH: usize = 200;
const MAX_RESPONSE_BYTES: usize = 2 * 1024 * 1024;

pub(crate) fn api_error_for_status(status: reqwest::StatusCode) -> FreesoundApiError {
    match status {
        reqwest::StatusCode::UNAUTHORIZED => FreesoundApiError::Unauthorized,
        reqwest::StatusCode::TOO_MANY_REQUESTS => FreesoundApiError::RateLimited,
        _ => FreesoundApiError::Request,
    }
}

pub(crate) async fn search(
    credential_path: &std::path::Path,
    query: &str,
    page: Option<u32>,
) -> Result<FreesoundSearchResponse, FreesoundApiError> {
    let query = validate_query(query)?;
    let page = validate_page(page)?;
    let key = read_credential(credential_path).map_err(FreesoundApiError::Credential)?;
    let page_value = page.to_string();
    let page_size_value = PAGE_SIZE.to_string();
    let response = api_client()?
        .get(API_SEARCH_URL)
        .header(AUTHORIZATION, authorization_header(&key))
        .query(&[
            ("query", query),
            ("page", page_value.as_str()),
            ("page_size", page_size_value.as_str()),
            ("fields", "id,name,url,username,license,previews"),
        ])
        .send()
        .await
        .map_err(|_| FreesoundApiError::Request)?;
    if !response.status().is_success() {
        return Err(api_error_for_status(response.status()));
    }
    let body = read_response_body(response).await?;
    let response =
        serde_json::from_slice::<SearchBody>(&body).map_err(|_| FreesoundApiError::Response)?;
    response.into_public(page, PAGE_SIZE)
}

async fn read_response_body(response: reqwest::Response) -> Result<Vec<u8>, FreesoundApiError> {
    let mut body = Vec::new();
    let mut stream = response.bytes_stream();
    while let Some(chunk) = stream.next().await {
        append_response_chunk(&mut body, &chunk.map_err(|_| FreesoundApiError::Response)?)?;
    }
    Ok(body)
}

fn append_response_chunk(body: &mut Vec<u8>, chunk: &[u8]) -> Result<(), FreesoundApiError> {
    if body
        .len()
        .checked_add(chunk.len())
        .is_none_or(|size| size > MAX_RESPONSE_BYTES)
    {
        return Err(FreesoundApiError::TooLarge);
    }
    body.extend_from_slice(chunk);
    Ok(())
}

fn api_client() -> Result<reqwest::Client, FreesoundApiError> {
    reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(10))
        .timeout(Duration::from_secs(30))
        .redirect(Policy::none())
        .build()
        .map_err(|_| FreesoundApiError::Request)
}

fn authorization_header(key: &FreesoundApiKey) -> String {
    format!("Token {}", key.secret())
}

fn validate_query(query: &str) -> Result<&str, FreesoundApiError> {
    let query = query.trim();
    if query.is_empty() || query.len() > MAX_QUERY_LENGTH {
        return Err(FreesoundApiError::InvalidQuery);
    }
    Ok(query)
}

fn validate_page(page: Option<u32>) -> Result<u32, FreesoundApiError> {
    let page = page.unwrap_or(1);
    if !(1..=MAX_PAGE).contains(&page) {
        return Err(FreesoundApiError::InvalidPage);
    }
    Ok(page)
}

#[cfg(test)]
#[path = "client_tests.rs"]
mod tests;
