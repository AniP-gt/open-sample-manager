use std::{io, path::PathBuf};

use tokio::sync::Semaphore;
use url::Url;

use super::{
    download_finalize::{finalize_download, DownloadFinalization},
    download_stream::{stream_to_private_file, streaming_budget, DISK_RESERVE},
    policy::{ProviderId, ProviderPolicyError},
    root::DownloadRoot,
};

static IMPORT_PERMIT: Semaphore = Semaphore::const_new(1);

#[derive(Debug, thiserror::Error)]
pub(crate) enum DownloadError {
    #[error(transparent)]
    Policy(#[from] ProviderPolicyError),
    #[error("provider download exceeded the configured size limit")]
    TooLarge,
    #[error("provider download has insufficient disk space")]
    InsufficientSpace,
    #[error("provider download failed: {0}")]
    Request(#[from] reqwest::Error),
    #[error("provider import failed: {0}")]
    Io(#[from] std::io::Error),
    #[error("provider archive was rejected: {0}")]
    Archive(#[from] super::archive::ArchiveError),
    #[error("provider import destination already exists")]
    PromotionConflict,
    #[error("another provider import is already running")]
    Busy,
}

impl DownloadError {
    pub(crate) const fn code(&self) -> &'static str {
        match self {
            Self::Policy(_) => "provider_policy_error",
            Self::TooLarge => "provider_download_limit",
            Self::InsufficientSpace => "provider_disk_space",
            Self::Request(_) => "provider_network_error",
            Self::Io(_) => "provider_storage_error",
            Self::Archive(_) => "provider_archive_rejected",
            Self::PromotionConflict => "provider_promotion_conflict",
            Self::Busy => "provider_import_busy",
        }
    }
}

pub(crate) async fn download_and_import(
    provider: ProviderId,
    url: Url,
    root: DownloadRoot,
) -> Result<PathBuf, DownloadError> {
    let _permit = IMPORT_PERMIT
        .try_acquire()
        .map_err(|_| DownloadError::Busy)?;
    if !provider.allows_download(&url) {
        return Err(ProviderPolicyError::UnapprovedUrl.into());
    }
    let preparation = run_blocking({
        let root = root.clone();
        move || prepare_download(root)
    })
    .await?;
    if let Err(error) = stream_to_private_file(
        provider,
        &url,
        &preparation.download_path,
        preparation.budget,
    )
    .await
    {
        return run_blocking(move || {
            drop(preparation);
            Err(error)
        })
        .await;
    }
    run_blocking(move || {
        finalize_download(DownloadFinalization {
            root,
            url,
            download_path: preparation.download_path,
            unpacked_path: preparation.staging.path().join("approved"),
        })
    })
    .await
}

struct DownloadPreparation {
    staging: tempfile::TempDir,
    download_path: PathBuf,
    budget: u64,
}

fn prepare_download(root: DownloadRoot) -> Result<DownloadPreparation, DownloadError> {
    let available_space = fs2::available_space(root.root())?;
    if available_space < DISK_RESERVE {
        return Err(DownloadError::InsufficientSpace);
    }
    root.revalidate()
        .map_err(|_| DownloadError::InsufficientSpace)?;
    let staging = tempfile::Builder::new()
        .prefix(".provider-")
        .tempdir_in(root.root())?;
    let download_path = staging.path().join("download.bin");
    Ok(DownloadPreparation {
        staging,
        download_path,
        budget: streaming_budget(available_space),
    })
}

async fn run_blocking<T>(
    operation: impl FnOnce() -> Result<T, DownloadError> + Send + 'static,
) -> Result<T, DownloadError>
where
    T: Send + 'static,
{
    tokio::task::spawn_blocking(operation)
        .await
        .map_err(|error| DownloadError::Io(io::Error::other(error)))?
}

#[cfg(test)]
mod tests {
    use super::{run_blocking, DownloadError, IMPORT_PERMIT};

    #[test]
    fn import_permit_rejects_a_concurrent_attempt() {
        let permit = IMPORT_PERMIT.try_acquire().expect("initial permit");
        assert!(matches!(
            IMPORT_PERMIT.try_acquire(),
            Err(tokio::sync::TryAcquireError::NoPermits)
        ));
        drop(permit);
    }

    #[test]
    fn busy_error_has_a_safe_code() {
        assert_eq!(DownloadError::Busy.code(), "provider_import_busy");
    }

    #[tokio::test(flavor = "current_thread")]
    async fn blocking_operations_run_away_from_the_runtime_worker() {
        let runtime_thread = std::thread::current().id();
        let blocking_thread = run_blocking(|| Ok(std::thread::current().id()))
            .await
            .expect("blocking operation");

        assert_ne!(blocking_thread, runtime_thread);
    }
}
