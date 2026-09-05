use tauri::{AppHandle, Manager};

use super::{ProviderBrowserSurface, ProviderCloseFailure, ProviderId, ProviderPolicyError};

pub(crate) fn close_all_provider_browsers(app: &AppHandle) -> Result<(), ProviderPolicyError> {
    close_provider_surfaces(ProviderId::all(), |provider, surface| match surface {
        ProviderBrowserSurface::Embedded => app
            .get_webview(provider.child_label())
            .map_or(Ok(()), |child| child.close().map_err(|_| ())),
        ProviderBrowserSurface::Window => app
            .get_webview_window(provider.window_label())
            .map_or(Ok(()), |window| window.close().map_err(|_| ())),
    })
}

pub(crate) fn close_provider_surfaces(
    providers: impl IntoIterator<Item = ProviderId>,
    mut close: impl FnMut(ProviderId, ProviderBrowserSurface) -> Result<(), ()>,
) -> Result<(), ProviderPolicyError> {
    let mut failures = Vec::new();
    for provider in providers {
        for surface in [
            ProviderBrowserSurface::Embedded,
            ProviderBrowserSurface::Window,
        ] {
            if close(provider, surface).is_err() {
                failures.push(ProviderCloseFailure::new(provider, surface));
            }
        }
    }
    if failures.is_empty() {
        Ok(())
    } else {
        Err(ProviderPolicyError::CloseAllFailed(failures))
    }
}

pub(crate) fn close_embedded_provider_browser(
    app: &AppHandle,
    provider: ProviderId,
) -> Result<Option<String>, ProviderPolicyError> {
    let Some(child) = app.get_webview(provider.child_label()) else {
        return Ok(None);
    };
    let url = child
        .url()
        .ok()
        .filter(|url| provider.allows_navigation(url))
        .map(|url| url.to_string());
    let _ = child.hide();
    child
        .close()
        .map_err(|_| ProviderPolicyError::SurfaceUnavailable)?;
    Ok(url)
}
