use tauri::{
    webview::{DownloadEvent, NewWindowFeatures, NewWindowResponse},
    AppHandle, Emitter, Runtime, Webview,
};
use url::Url;

use super::{download_and_import, DownloadRoot, ProviderId};

#[derive(Clone, serde::Serialize)]
struct ProviderImportReady {
    provider: ProviderId,
    directory: String,
}

#[derive(Clone, serde::Serialize)]
struct ProviderImportFailed {
    provider: ProviderId,
    code: &'static str,
}

pub(crate) fn navigation_handler(provider: ProviderId) -> impl Fn(&Url) -> bool + Send + 'static {
    move |url| provider.allows_navigation(url) || provider.allows_download(url)
}

pub(crate) fn popup_handler<R: Runtime>(
) -> impl Fn(Url, NewWindowFeatures) -> NewWindowResponse<R> + Send + 'static {
    |_url, _features| NewWindowResponse::Deny
}

pub(crate) fn download_handler(
    app: AppHandle,
    provider: ProviderId,
    root: DownloadRoot,
) -> impl Fn(Webview, DownloadEvent<'_>) -> bool + Send + Sync + 'static {
    move |_webview, event| {
        if let DownloadEvent::Requested { url, .. } = event {
            let allowed = provider.allows_download(&url);
            if allowed {
                let handle = app.clone();
                let root = root.clone();
                tauri::async_runtime::spawn(async move {
                    match download_and_import(provider, url, root).await {
                        Ok(directory) => {
                            let _ = handle.emit(
                                "provider-import-ready",
                                ProviderImportReady {
                                    provider,
                                    directory: directory.to_string_lossy().into_owned(),
                                },
                            );
                        }
                        Err(error) => {
                            let _ = emit_failure(&handle, provider, error.code());
                        }
                    }
                });
            }
        }
        false
    }
}

fn emit_failure(handle: &AppHandle, provider: ProviderId, code: &'static str) -> tauri::Result<()> {
    handle.emit(
        "provider-import-failed",
        ProviderImportFailed { provider, code },
    )
}

#[cfg(test)]
#[path = "hooks_tests.rs"]
mod tests;
