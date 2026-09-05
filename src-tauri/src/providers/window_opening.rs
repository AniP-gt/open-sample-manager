use tauri::{webview::WebviewBuilder, AppHandle, WebviewUrl, WebviewWindowBuilder};

use super::super::hooks::{download_handler, navigation_handler, popup_handler};
use super::{
    bounds::{main_window, validate_bounds},
    script::fifty_sounds_modal_download_initialization_script,
    DownloadRoot, ProviderBounds, ProviderBrowserMode, ProviderId, ProviderPolicyError,
};

pub(crate) fn open_provider_browser(
    app: &AppHandle,
    provider: ProviderId,
    mode: ProviderBrowserMode,
    root: DownloadRoot,
    bounds: Option<ProviderBounds>,
    resume_url: Option<&str>,
) -> Result<(), ProviderPolicyError> {
    super::closing::close_all_provider_browsers(app)?;
    match mode {
        ProviderBrowserMode::Embedded => open_embedded(app, provider, root, bounds, resume_url),
        ProviderBrowserMode::Window => open_window(app, provider, root),
    }
}

fn open_window(
    app: &AppHandle,
    provider: ProviderId,
    root: DownloadRoot,
) -> Result<(), ProviderPolicyError> {
    let homepage = provider.homepage()?;
    let main = main_window(app)?;
    let mut window =
        WebviewWindowBuilder::new(app, provider.window_label(), WebviewUrl::External(homepage))
            .parent(&main)
            .map_err(|_| ProviderPolicyError::SurfaceUnavailable)?
            .title("Sample provider")
            .inner_size(1200.0, 800.0)
            .center()
            .on_navigation(navigation_handler(provider))
            .on_new_window(popup_handler())
            .on_download(download_handler(app.clone(), provider, root));
    if provider == ProviderId::FiftySounds {
        window = window.initialization_script(fifty_sounds_modal_download_initialization_script());
    }
    let window = window
        .build()
        .map_err(|_| ProviderPolicyError::SurfaceUnavailable)?;
    show_and_focus(|| window.show(), || window.set_focus())
}

fn open_embedded(
    app: &AppHandle,
    provider: ProviderId,
    root: DownloadRoot,
    bounds: Option<ProviderBounds>,
    resume_url: Option<&str>,
) -> Result<(), ProviderPolicyError> {
    let main = main_window(app)?;
    let bounds = bounds.ok_or(ProviderPolicyError::MissingEmbeddedBounds)?;
    let bounds = validate_bounds(&main, bounds)?;
    let initial_url = match provider.approved_navigation_url(resume_url) {
        Some(url) => url,
        None => provider.homepage()?,
    };
    let mut builder =
        WebviewBuilder::new(provider.child_label(), WebviewUrl::External(initial_url))
            .on_navigation(navigation_handler(provider))
            .on_new_window(popup_handler())
            .on_download(download_handler(app.clone(), provider, root));
    if provider == ProviderId::FiftySounds {
        builder =
            builder.initialization_script(fifty_sounds_modal_download_initialization_script());
    }
    let child = main
        .as_ref()
        .window()
        .add_child(builder, bounds.position(), bounds.size())
        .map_err(|_| ProviderPolicyError::SurfaceUnavailable)?;
    let _ = child.set_focus();
    Ok(())
}

fn show_and_focus(
    show: impl FnOnce() -> tauri::Result<()>,
    focus: impl FnOnce() -> tauri::Result<()>,
) -> Result<(), ProviderPolicyError> {
    show().map_err(|_| ProviderPolicyError::SurfaceUnavailable)?;
    let _ = focus();
    Ok(())
}
