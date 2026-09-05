use tauri::{AppHandle, Manager};

use crate::providers::{
    close_all_provider_browsers as close_all_browsers,
    close_embedded_provider_browser as close_embedded_browser,
    go_back_provider_browser as go_back_browser, go_forward_provider_browser as go_forward_browser,
    hide_provider_browser as hide_browser, open_provider_browser as open_browser,
    set_provider_browser_bounds as set_browser_bounds, show_provider_browser as show_browser,
    DownloadRoot, ProviderBounds, ProviderBrowserMode, ProviderId, ProviderPolicyError,
    ProviderRootError,
};

use super::CommandError;

impl From<ProviderPolicyError> for CommandError {
    fn from(value: ProviderPolicyError) -> Self {
        let code = match value {
            ProviderPolicyError::UnapprovedUrl => "provider_url_unapproved",
            ProviderPolicyError::InvalidBounds => "provider_bounds_invalid",
            ProviderPolicyError::SurfaceUnavailable => "provider_surface_unavailable",
            ProviderPolicyError::MissingEmbeddedBounds => "provider_bounds_required",
            ProviderPolicyError::CloseAllFailed(_) => "provider_surface_unavailable",
        };
        Self {
            code: code.to_string(),
            message: value.to_string(),
            details: None,
        }
    }
}

impl From<ProviderRootError> for CommandError {
    fn from(value: ProviderRootError) -> Self {
        let code = match value {
            ProviderRootError::InvalidRoot => "provider_root_invalid",
            ProviderRootError::UnusableRoot => "provider_root_unusable",
            ProviderRootError::Storage(_) => "provider_root_storage_error",
        };
        Self {
            code: code.to_string(),
            message: value.to_string(),
            details: None,
        }
    }
}

async fn prepare_download_root(
    download_root: Option<String>,
    app_data: std::path::PathBuf,
) -> Result<DownloadRoot, CommandError> {
    tokio::task::spawn_blocking(move || DownloadRoot::from_optional(download_root, app_data))
        .await
        .map_err(|error| CommandError {
            code: "provider_root_storage_error".to_string(),
            message: error.to_string(),
            details: None,
        })?
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn open_provider_browser(
    provider: ProviderId,
    mode: Option<ProviderBrowserMode>,
    download_root: Option<String>,
    bounds: Option<ProviderBounds>,
    url: Option<String>,
    app: AppHandle,
) -> Result<(), CommandError> {
    let mode = mode.unwrap_or_default();
    let bounds = match (mode, bounds) {
        (ProviderBrowserMode::Embedded, Some(bounds)) => Some(
            bounds
                .validate_shape()
                .map_err(|_| CommandError::from(ProviderPolicyError::InvalidBounds))?,
        ),
        (ProviderBrowserMode::Embedded, None) => {
            return Err(CommandError::from(
                ProviderPolicyError::MissingEmbeddedBounds,
            ));
        }
        (ProviderBrowserMode::Window, bounds) => bounds,
    };
    let app_data = app.path().app_data_dir().map_err(|error| CommandError {
        code: "provider_root_storage_error".to_string(),
        message: error.to_string(),
        details: None,
    })?;
    let root = prepare_download_root(download_root, app_data).await?;
    open_browser(&app, provider, mode, root, bounds, url.as_deref()).map_err(CommandError::from)
}

#[tauri::command]
pub fn set_provider_browser_bounds(
    provider: ProviderId,
    bounds: ProviderBounds,
    app: AppHandle,
) -> Result<(), CommandError> {
    let bounds = bounds
        .validate_shape()
        .map_err(|_| CommandError::from(ProviderPolicyError::InvalidBounds))?;
    set_browser_bounds(&app, provider, bounds).map_err(CommandError::from)
}

#[tauri::command]
pub fn show_provider_browser(provider: ProviderId, app: AppHandle) -> Result<(), CommandError> {
    show_browser(&app, provider).map_err(CommandError::from)
}

#[tauri::command]
pub fn hide_provider_browser(provider: ProviderId, app: AppHandle) -> Result<(), CommandError> {
    hide_browser(&app, provider).map_err(CommandError::from)
}

#[tauri::command]
pub fn close_all_provider_browsers(app: AppHandle) -> Result<(), CommandError> {
    close_all_browsers(&app).map_err(CommandError::from)
}

#[tauri::command]
pub fn close_embedded_provider_browser(
    provider: ProviderId,
    app: AppHandle,
) -> Result<Option<String>, CommandError> {
    close_embedded_browser(&app, provider).map_err(CommandError::from)
}

#[tauri::command]
pub fn go_back_provider_browser(provider: ProviderId, app: AppHandle) -> Result<(), CommandError> {
    go_back_browser(&app, provider).map_err(CommandError::from)
}

#[tauri::command]
pub fn go_forward_provider_browser(
    provider: ProviderId,
    app: AppHandle,
) -> Result<(), CommandError> {
    go_forward_browser(&app, provider).map_err(CommandError::from)
}

#[cfg(test)]
mod tests {
    use super::{prepare_download_root, CommandError, ProviderPolicyError};

    #[test]
    fn provider_surface_errors_preserve_their_invoke_error_code() {
        let error = CommandError::from(ProviderPolicyError::SurfaceUnavailable);

        assert_eq!(error.code, "provider_surface_unavailable");
    }

    #[test]
    fn aggregate_provider_close_errors_preserve_their_invoke_error_code() {
        let error = CommandError::from(ProviderPolicyError::CloseAllFailed(Vec::new()));

        assert_eq!(error.code, "provider_surface_unavailable");
    }

    #[test]
    fn blocking_download_root_validation_preserves_the_invoke_error_code() {
        // Given: a root that DownloadRoot rejects at the filesystem boundary.
        let runtime = tokio::runtime::Runtime::new().expect("runtime");
        let app_data = tempfile::tempdir().expect("app data").path().join("app");

        // When: validation runs through the command's blocking-work boundary.
        let error = runtime
            .block_on(prepare_download_root(
                Some("relative".to_string()),
                app_data,
            ))
            .expect_err("invalid root");

        // Then: the typed invoke error code remains stable.
        assert_eq!(error.code, "provider_root_invalid");
    }
}
