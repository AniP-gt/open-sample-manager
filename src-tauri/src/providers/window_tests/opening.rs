use super::super::ProviderBrowserMode;
use super::{opening_source, script_source};

#[test]
fn provider_browser_mode_uses_snake_case_serde() {
    assert_eq!(
        serde_json::from_str::<ProviderBrowserMode>("\"embedded\"").ok(),
        Some(ProviderBrowserMode::Embedded)
    );
    assert_eq!(
        serde_json::to_string(&ProviderBrowserMode::Window)
            .ok()
            .as_deref(),
        Some("\"window\"")
    );
    assert_eq!(ProviderBrowserMode::default(), ProviderBrowserMode::Window);
}

#[test]
fn separate_window_lifecycle_shows_and_focuses_built_window() {
    let source = opening_source();
    let build = source
        .find(".build()")
        .expect("window builder must build a window");
    let lifecycle = source[build..]
        .find("show_and_focus(|| window.show(), || window.set_focus())")
        .expect("built provider window must be shown and focused");
    assert!(lifecycle > 0);
}

#[test]
fn embedded_child_lifecycle_relies_on_add_child_and_best_effort_focus() {
    let source = opening_source();
    let embedded = source
        .find("fn open_embedded(")
        .expect("embedded provider operation must exist");
    let embedded = &source[embedded..];
    let end = embedded
        .find("\nfn show_and_focus")
        .expect("embedded provider operation must end before the shared helper");
    let embedded = &embedded[..end];
    let add_child = embedded
        .find(".add_child(")
        .expect("embedded provider must add a child webview");
    let after_add_child = &embedded[add_child..];
    let focus = after_add_child
        .find("let _ = child.set_focus();")
        .expect("embedded child focus must be best-effort");
    let success = after_add_child
        .find("Ok(())")
        .expect("embedded child open must return success after add_child");

    assert!(!after_add_child.contains("child.show()"));
    assert!(!after_add_child.contains("show_and_focus"));
    assert!(focus < success);
}

#[test]
fn provider_surface_show_failure_propagates_while_focus_failure_is_ignored() {
    let source = opening_source();
    let helper = source
        .find("fn show_and_focus(")
        .expect("provider surface helper must exist");
    let operation = &source[helper..];

    assert!(operation.contains("show().map_err(|_| ProviderPolicyError::SurfaceUnavailable)?;"));
    assert!(operation.contains("let _ = focus();"));
    assert!(!operation.contains(".and_then(|_| focus())"));
}

#[test]
fn separate_window_has_default_size_and_center_placement() {
    let source = opening_source();
    let builder = source
        .find("WebviewWindowBuilder::new(")
        .expect("provider window builder must exist");
    let size = source[builder..]
        .find(".inner_size(1200.0, 800.0)")
        .expect("provider window must have a default size");
    let center = source[builder + size..]
        .find(".center()")
        .expect("provider window must be centered");
    assert!(center > 0);
}

#[test]
fn fiftysounds_modal_download_script_is_scoped_and_installed_in_both_surfaces() {
    let script = script_source();

    assert!(script.contains("https://www.fiftysounds.com"));
    assert!(script.contains("/royalty-free-music/"));
    assert!(script.contains("window.location.origin"));
    assert!(script.contains("#myModal"));
    assert!(script.contains("location.pathname"));
    assert!(script.contains(
        "^https://www\\\\.fiftysounds\\\\.com/music/[A-Za-z0-9][A-Za-z0-9._-]*\\\\.zip$"
    ));
    let resolved_href = script
        .find("const url = new URL(href, window.location.href);")
        .expect("modal href must resolve against the current article URL");
    let validated_href = script
        .find("directZip.test(url.href)")
        .expect("resolved modal href must receive strict direct-ZIP validation");
    assert!(resolved_href < validated_href);
    assert!(script.contains("anchor.click()"));
    assert!(!script.contains("invoke("));

    let source = opening_source();
    for operation_name in ["fn open_window(", "fn open_embedded("] {
        let operation_start = source
            .find(operation_name)
            .expect("provider browser operation must exist");
        let operation = &source[operation_start..];
        let operation = operation
            .find("\nfn ")
            .map_or(operation, |end| &operation[..end]);

        assert!(operation.contains("ProviderId::FiftySounds"));
        assert!(operation.contains(
            ".initialization_script(fifty_sounds_modal_download_initialization_script())"
        ));
    }
}
