use std::{path::Path, time::Duration};

use futures_util::StreamExt;
use tokio::io::AsyncWriteExt;
use url::Url;

use super::{download::DownloadError, policy::ProviderId};

const MAX_DOWNLOAD_SIZE: u64 = 500 * 1024 * 1024;
pub(super) const DISK_RESERVE: u64 = 512 * 1024 * 1024;

pub(super) async fn stream_to_private_file(
    provider: ProviderId,
    url: &Url,
    destination: &Path,
    budget: u64,
) -> Result<(), DownloadError> {
    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(15))
        .timeout(Duration::from_secs(120))
        .redirect(reqwest::redirect::Policy::custom(move |attempt| {
            if attempt.previous().len() >= 10 || !provider.allows_download(attempt.url()) {
                attempt.error("unapproved redirect")
            } else {
                attempt.follow()
            }
        }))
        .build()?;
    let response = client.get(url.clone()).send().await?.error_for_status()?;
    if response
        .content_length()
        .is_some_and(|size| size > MAX_DOWNLOAD_SIZE)
    {
        return Err(DownloadError::TooLarge);
    }
    let mut stream = response.bytes_stream();
    let mut output = tokio::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(destination)
        .await?;
    let mut total = 0_u64;
    while let Some(chunk) = stream.next().await {
        let chunk = chunk?;
        total = total
            .checked_add(u64::try_from(chunk.len()).map_err(|_| DownloadError::TooLarge)?)
            .ok_or(DownloadError::TooLarge)?;
        if total > budget {
            return Err(DownloadError::TooLarge);
        }
        output.write_all(&chunk).await?;
    }
    output.flush().await?;
    Ok(())
}

pub(super) fn streaming_budget(available_space: u64) -> u64 {
    available_space
        .saturating_sub(DISK_RESERVE)
        .min(MAX_DOWNLOAD_SIZE)
}

#[cfg(test)]
mod tests {
    use super::{streaming_budget, DISK_RESERVE, MAX_DOWNLOAD_SIZE};

    #[test]
    fn streaming_budget_preserves_disk_reserve() {
        assert_eq!(streaming_budget(DISK_RESERVE - 1), 0);
        assert_eq!(streaming_budget(DISK_RESERVE + 64), 64);
        assert_eq!(streaming_budget(u64::MAX), MAX_DOWNLOAD_SIZE);
    }
}
