use super::{bounds_source, closing_source, opening_source, script_source};

#[test]
fn provider_window_has_no_temporary_stage_tracing() {
    let source = [
        opening_source(),
        closing_source(),
        bounds_source(),
        script_source(),
    ]
    .concat();

    for temporary_trace in [
        "trace_provider_stage",
        "std::io::Write",
        "/tmp/osm-provider-stage.log",
    ] {
        assert!(!source.contains(temporary_trace));
    }
}

#[test]
fn provider_download_uses_custom_import_without_temporary_diagnostics_or_live_tests() {
    let workspace = include_str!("../../../../Cargo.toml");
    let hooks = include_str!("../hooks.rs");
    let download = include_str!("../download.rs");

    assert!(workspace.contains("[profile.dev.package.wry]"));
    assert!(workspace.contains("debug-assertions = false"));
    assert!(workspace.contains("[profile.dev.package.tauri-runtime-wry]"));
    assert!(workspace.contains("[profile.dev.package.tauri-runtime]"));
    assert!(workspace.contains("[profile.dev.package.tauri]"));
    assert!(hooks.contains("let allowed = provider.allows_download(&url);"));
    assert!(hooks.contains("download_and_import(provider, url, root).await"));
    assert!(hooks.contains("\"provider-import-ready\""));
    assert!(hooks.contains("emit_failure(&handle, provider, error.code())"));
    assert!(hooks.contains("false\n    }\n}"));
    assert!(!hooks.contains("trace_download"));
    assert!(!hooks.contains("/tmp/osm-provider-download.log"));
    assert!(!download.contains("debug_live_fifty_sounds_download_pipeline"));
}

#[test]
fn provider_import_events_emit_through_app_handle_without_main_window_lookup() {
    let hooks = include_str!("../hooks.rs");
    let ready = hooks
        .find("Ok(directory) =>")
        .expect("successful provider import branch must exist");
    let ready = &hooks[ready..];
    let ready = ready
        .find("Err(error) =>")
        .map_or(ready, |end| &ready[..end]);
    let failure = hooks
        .find("fn emit_failure(")
        .expect("provider failure emission helper must exist");
    let failure = &hooks[failure..];

    assert!(ready.contains("handle.emit("));
    assert!(ready.contains("\"provider-import-ready\""));
    assert!(failure.contains("handle.emit("));
    assert!(failure.contains("\"provider-import-failed\""));
    assert!(!hooks.contains("get_webview_window(\"main\")"));
    assert!(!hooks.contains("[provider-emit-debug]"));
}

#[test]
fn provider_capabilities_isolate_main_and_provider_webviews() {
    let default: serde_json::Value =
        serde_json::from_str(include_str!("../../../capabilities/default.json"))
            .expect("default capability JSON parses");
    let provider: serde_json::Value =
        serde_json::from_str(include_str!("../../../capabilities/provider-browser.json"))
            .expect("provider capability JSON parses");
    let macos_drag: serde_json::Value =
        serde_json::from_str(include_str!("../../../capabilities/macos-drag.json"))
            .expect("macOS drag capability JSON parses");

    assert_eq!(default["webviews"], serde_json::json!(["main"]));
    assert!(default.get("windows").is_none());
    assert_eq!(macos_drag["webviews"], serde_json::json!(["main"]));
    assert!(macos_drag.get("windows").is_none());
    assert_eq!(
        macos_drag["permissions"],
        serde_json::json!(["drag:allow-start-drag"])
    );
    assert_eq!(
        provider["webviews"],
        serde_json::json!(["provider-child-musicradar", "provider-child-fiftysounds"])
    );
    assert_eq!(
        provider["windows"],
        serde_json::json!(["provider-musicradar", "provider-fiftysounds"])
    );
    assert_eq!(provider["permissions"], serde_json::json!([]));
    for permission in [
        "allow-go-back-provider-browser",
        "allow-go-forward-provider-browser",
    ] {
        assert!(default["permissions"]
            .as_array()
            .is_some_and(|permissions| permissions.iter().any(|value| value == permission)));
    }
    assert!(provider.get("remote").is_none());
    assert!(provider["webviews"].as_array().is_some_and(|labels| labels
        .iter()
        .all(|label| !label.as_str().is_some_and(|label| label.contains('*')))));

    let capabilities = [default, provider, macos_drag];
    for provider_label in [
        "provider-musicradar",
        "provider-fiftysounds",
        "provider-child-musicradar",
        "provider-child-fiftysounds",
    ] {
        let permissions: Vec<&serde_json::Value> = capabilities
            .iter()
            .filter(|capability| {
                ["windows", "webviews"].iter().any(|target_key| {
                    capability[*target_key].as_array().is_some_and(|targets| {
                        targets.iter().any(|target| target == provider_label)
                    })
                })
            })
            .flat_map(|capability| capability["permissions"].as_array().into_iter().flatten())
            .collect();
        assert!(
            permissions.is_empty(),
            "provider label {provider_label} received permissions: {permissions:?}"
        );
    }

    let config: serde_json::Value = serde_json::from_str(include_str!("../../../tauri.conf.json"))
        .expect("Tauri config JSON parses");
    assert_eq!(config["app"]["security"]["assetProtocol"]["enable"], false);
}
