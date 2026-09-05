use super::super::closing::close_provider_surfaces;
use super::super::{ProviderBrowserSurface, ProviderCloseFailure, ProviderId, ProviderPolicyError};
use super::{bounds_source, closing_source};

#[test]
fn close_provider_surfaces_attempts_later_surfaces_after_a_failure() {
    let mut attempted = Vec::new();

    let result = close_provider_surfaces(ProviderId::all(), |provider, surface| {
        attempted.push((provider, surface));
        if provider == ProviderId::MusicRadar && surface == ProviderBrowserSurface::Embedded {
            Err(())
        } else {
            Ok(())
        }
    });

    assert_eq!(
        attempted,
        vec![
            (ProviderId::MusicRadar, ProviderBrowserSurface::Embedded),
            (ProviderId::MusicRadar, ProviderBrowserSurface::Window),
            (ProviderId::FiftySounds, ProviderBrowserSurface::Embedded),
            (ProviderId::FiftySounds, ProviderBrowserSurface::Window),
        ]
    );
    assert_eq!(
        result,
        Err(ProviderPolicyError::CloseAllFailed(vec![
            ProviderCloseFailure::new(ProviderId::MusicRadar, ProviderBrowserSurface::Embedded),
        ]))
    );
}

#[test]
fn provider_scoped_close_captures_approved_url_and_closes_after_hide_failure() {
    let source = closing_source();
    let close_operation = source
        .find("fn close_embedded_provider_browser(")
        .expect("provider-scoped embedded close operation must exist");
    let operation = &source[close_operation..];
    let missing_child = operation
        .find("let Some(child) = app.get_webview(provider.child_label()) else {")
        .expect("missing provider child must be handled idempotently");
    let capture = operation
        .find(".url()")
        .expect("provider child URL must be captured before closing");
    let approval = operation
        .find("provider.allows_navigation(url)")
        .expect("captured URL must use the provider navigation policy");
    let hide = operation
        .find(".hide()")
        .expect("provider child must be hidden before closing");
    let close = operation
        .find(".close()")
        .expect("provider child must be closed");
    let ignored_hide_failure = operation
        .find("let _ = child.hide();")
        .expect("provider child close must proceed when hide fails");

    assert!(missing_child < capture);
    assert!(capture < approval);
    assert!(approval < hide);
    assert!(hide < close);
    assert!(ignored_hide_failure < close);
}

#[test]
fn provider_scoped_history_evaluates_fixed_scripts_in_the_embedded_child_only() {
    let source = bounds_source();

    for (operation, script) in [
        ("go_back_provider_browser", "window.history.back();"),
        ("go_forward_provider_browser", "window.history.forward();"),
    ] {
        let operation = source
            .find(&format!("fn {operation}("))
            .expect("provider history operation must exist");
        let operation = &source[operation..];
        let operation = operation
            .find("\npub(crate) fn")
            .or_else(|| operation.find("\npub(super) fn"))
            .map_or(operation, |end| &operation[..end]);

        assert!(operation.contains(".get_webview(provider.child_label())"));
        assert!(operation.contains(&format!(".eval(\"{script}\")")));
        assert!(!operation.contains("get_webview_window"));
    }
}
