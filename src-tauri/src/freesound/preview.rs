use std::time::Duration;

use futures_util::StreamExt;
use reqwest::redirect::Policy;
use url::Url;

use super::{api_error_for_status, policy::is_preview_url, FreesoundApiError};

const MAX_PREVIEW_BYTES: usize = 15 * 1024 * 1024;

pub(crate) async fn fetch_preview(preview_url: &str) -> Result<Vec<u8>, FreesoundApiError> {
    let url = preview_url
        .parse::<Url>()
        .map_err(|_| FreesoundApiError::InvalidPreviewUrl)?;
    if !is_preview_url(&url) {
        return Err(FreesoundApiError::InvalidPreviewUrl);
    }
    let response = client()?
        .get(url)
        .send()
        .await
        .map_err(|_| FreesoundApiError::Request)?;
    if !response.status().is_success() {
        return Err(api_error_for_status(response.status()));
    }
    if response
        .content_length()
        .is_some_and(|length| length > MAX_PREVIEW_BYTES as u64)
    {
        return Err(FreesoundApiError::TooLarge);
    }
    let mut bytes = Vec::new();
    let mut stream = response.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|_| FreesoundApiError::Request)?;
        if bytes
            .len()
            .checked_add(chunk.len())
            .is_none_or(|length| length > MAX_PREVIEW_BYTES)
        {
            return Err(FreesoundApiError::TooLarge);
        }
        bytes.extend_from_slice(&chunk);
    }
    Ok(bytes)
}

fn client() -> Result<reqwest::Client, FreesoundApiError> {
    reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(10))
        .timeout(Duration::from_secs(30))
        .redirect(Policy::custom(|attempt| {
            if attempt.previous().len() >= 5 || !is_preview_url(attempt.url()) {
                attempt.error("unapproved redirect")
            } else {
                attempt.follow()
            }
        }))
        .build()
        .map_err(|_| FreesoundApiError::Request)
}
