use tauri::{AppHandle, Manager};

use super::{ProviderBounds, ProviderBoundsError, ProviderId, ProviderPolicyError};

pub(crate) fn set_provider_browser_bounds(
    app: &AppHandle,
    provider: ProviderId,
    bounds: ProviderBounds,
) -> Result<(), ProviderPolicyError> {
    let main = main_window(app)?;
    let bounds = validate_bounds(&main, bounds)?;
    let child = app
        .get_webview(provider.child_label())
        .ok_or(ProviderPolicyError::SurfaceUnavailable)?;
    child
        .set_position(bounds.position())
        .and_then(|_| child.set_size(bounds.size()))
        .map_err(|_| ProviderPolicyError::SurfaceUnavailable)
}

pub(crate) fn show_provider_browser(
    app: &AppHandle,
    provider: ProviderId,
) -> Result<(), ProviderPolicyError> {
    if let Some(child) = app.get_webview(provider.child_label()) {
        return child
            .show()
            .map_err(|_| ProviderPolicyError::SurfaceUnavailable);
    }
    app.get_webview_window(provider.window_label())
        .ok_or(ProviderPolicyError::SurfaceUnavailable)?
        .show()
        .map_err(|_| ProviderPolicyError::SurfaceUnavailable)
}

pub(crate) fn hide_provider_browser(
    app: &AppHandle,
    provider: ProviderId,
) -> Result<(), ProviderPolicyError> {
    if let Some(child) = app.get_webview(provider.child_label()) {
        return child
            .hide()
            .map_err(|_| ProviderPolicyError::SurfaceUnavailable);
    }
    app.get_webview_window(provider.window_label())
        .ok_or(ProviderPolicyError::SurfaceUnavailable)?
        .hide()
        .map_err(|_| ProviderPolicyError::SurfaceUnavailable)
}

pub(crate) fn go_back_provider_browser(
    app: &AppHandle,
    provider: ProviderId,
) -> Result<(), ProviderPolicyError> {
    let child = app
        .get_webview(provider.child_label())
        .ok_or(ProviderPolicyError::SurfaceUnavailable)?;
    child
        .eval("window.history.back();")
        .map_err(|_| ProviderPolicyError::SurfaceUnavailable)
}

pub(crate) fn go_forward_provider_browser(
    app: &AppHandle,
    provider: ProviderId,
) -> Result<(), ProviderPolicyError> {
    let child = app
        .get_webview(provider.child_label())
        .ok_or(ProviderPolicyError::SurfaceUnavailable)?;
    child
        .eval("window.history.forward();")
        .map_err(|_| ProviderPolicyError::SurfaceUnavailable)
}

pub(super) fn main_window(app: &AppHandle) -> Result<tauri::WebviewWindow, ProviderPolicyError> {
    app.get_webview_window("main")
        .ok_or(ProviderPolicyError::SurfaceUnavailable)
}

pub(super) fn validate_bounds(
    main: &tauri::WebviewWindow,
    bounds: ProviderBounds,
) -> Result<ProviderBounds, ProviderPolicyError> {
    let physical_size = main
        .inner_size()
        .map_err(|_| ProviderPolicyError::SurfaceUnavailable)?;
    let scale_factor = main
        .scale_factor()
        .map_err(|_| ProviderPolicyError::SurfaceUnavailable)?;
    bounds
        .validate_in(physical_size.to_logical(scale_factor))
        .map_err(provider_bounds_error)
}

fn provider_bounds_error(error: ProviderBoundsError) -> ProviderPolicyError {
    match error {
        ProviderBoundsError::Invalid
        | ProviderBoundsError::TooLarge
        | ProviderBoundsError::OutsideMainWindow => ProviderPolicyError::InvalidBounds,
    }
}
