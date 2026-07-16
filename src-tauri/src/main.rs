// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use open_sample_manager_core::SampleManager;

mod app_state;
mod commands;
mod external_commands;
mod http_api;
mod local_api_runtime;

use crate::app_state::{AppRuntimeState, AppState, PreparedTempRegistry};
use crate::commands::*;
use crate::external_commands::emit_ui_command_wake as emit_ui_command_wake_event;
use std::sync::{Arc, Mutex};
use tauri::Manager;

fn main() {
    // Create the builder and register plugins. We register the dragout plugin
    // only on macOS because it purposefully fails to compile on other
    // platforms (it uses macOS-only Objective-C APIs). Keeping the conditional
    // registration here avoids build errors on Linux/Windows while enabling
    // native file-promise drag semantics on macOS.
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_clipboard_manager::init());

    #[cfg(target_os = "macos")]
    {
        builder = builder
            .plugin(tauri_plugin_dragout::init())
            .plugin(tauri_plugin_drag::init());
    }
    let local_api_runtime_state: Arc<Mutex<Option<local_api_runtime::LocalApiRuntime>>> =
        Arc::new(Mutex::new(None));
    builder = builder.setup({
        let local_api_runtime_state = Arc::clone(&local_api_runtime_state);
        move |app| {
            let db_path = match app.path().app_data_dir() {
                Ok(dir) => {
                    let _ = std::fs::create_dir_all(&dir);
                    Some(dir.join("samples.db"))
                }
                Err(_) => None,
            };

            let db_path_str = db_path
                .as_ref()
                .map(|path| path.to_string_lossy().to_string());
            let manager = SampleManager::new(db_path_str.as_deref()).map_err(|error| {
                eprintln!("failed to open database at {db_path_str:?}: {error}");
                std::io::Error::other(format!("failed to open database: {error}"))
            })?;

            let prepared_temp_paths: PreparedTempRegistry =
                Arc::new(Mutex::new(std::collections::HashSet::new()));
            let timidity_pid = Arc::new(Mutex::new(None));
            let temp_midi_preview_file = Arc::new(Mutex::new(None));
            let runtime =
                AppRuntimeState::new(prepared_temp_paths, timidity_pid, temp_midi_preview_file);
            let app_state = AppState::with_defaults(manager, runtime);
            let manager = Arc::clone(&app_state.manager);
            let ui_commands = app_state.ui_command_queue();
            app.manage(app_state);

            let emit_ui_command_wake = {
                let app_handle = app.app_handle().clone();
                Arc::new(move || emit_ui_command_wake_event(&app_handle))
            };

            let local_api_runtime = match app.path().app_data_dir() {
                Ok(app_data_dir) => {
                    match local_api_runtime::start_local_api_with_manager_and_wake_default(
                        local_api_runtime::LocalApiDataDirectory::new(app_data_dir),
                        manager,
                        ui_commands,
                        emit_ui_command_wake,
                    ) {
                        Ok(runtime) => Some(runtime),
                        Err(error) => {
                            eprintln!(
                                "warning: failed to start localhost API on 127.0.0.1:37421: {error}"
                            );
                            None
                        }
                    }
                }
                Err(error) => {
                    eprintln!(
                        "warning: unable to resolve app data directory for localhost API: {error}"
                    );
                    None
                }
            };

            if let Ok(mut runtime_slot) = local_api_runtime_state.lock() {
                *runtime_slot = local_api_runtime;
            }
            app.manage(Arc::clone(&local_api_runtime_state));
            Ok(())
        }
    });

    builder = builder.invoke_handler(tauri::generate_handler![
        health_check,
        scan_directory,
        export_library_database,
        import_library_database,
        import_file,
        search_samples,
        // Paginated listing/search exposed to renderer. list_samples_paginated
        // currently ignores the `query` parameter and returns a LIMIT/OFFSET
        // paginated listing. Future change will wire server-side FTS filtering.
        list_samples_paginated,
        list_samples_around_id,
        search_by_embedding,
        get_sample,
        get_samples_by_ids,
        list_collections,
        get_collection_members,
        list_all_sample_paths,
        list_duplicate_groups,
        delete_sample,
        clear_all_samples,
        re_scan_all_samples,
        move_sample,
        send_to_trash,
        update_sample_classification,
        update_sample_license_metadata,
        get_instrument_types,
        add_instrument_type,
        delete_instrument_type,
        update_instrument_type,
        open_folder,
        copy_to_clipboard,
        prepare_drag_file,
        prepare_processed_drag_file,
        delete_file,
        get_drag_icon_path,
        debug_start_drag,
        debug_try_deserialize,
        claim_ui_command_queue,
        acknowledge_ui_command,
        nack_ui_command,
        emit_ui_command_wake,
        // MIDI commands
        check_timidity,
        play_midi,
        stop_midi,
        scan_midi_directory,
        list_midis_paginated,
        list_midis_around_id,
        get_all_midi_paths,
        get_midi,
        delete_midi,
        clear_all_midis,
        search_midis,
        search_midis_paginated,
        // MIDI tag commands
        get_midi_tags,
        add_midi_tag,
        delete_midi_tag,
        update_midi_tag,
        set_midi_file_tag,
        get_midi_file_tags,
    ]);
    let app = match builder.build(tauri::generate_context!()) {
        Ok(app) => app,
        Err(error) => {
            eprintln!("error while building Tauri application: {error}");
            std::process::exit(1);
        }
    };
    app.run(move |_app_handle, event| {
        if matches!(event, tauri::RunEvent::Exit) {
            if let Ok(mut runtime_slot) = local_api_runtime_state.lock() {
                if let Some(runtime) = runtime_slot.as_mut() {
                    runtime.shutdown();
                }
            }
        }
    });
}
