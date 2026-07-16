use open_sample_manager_core::{LibraryExportSummary, LibraryImportSummary};
use std::sync::Arc;
use tauri::{AppHandle, Emitter};

use crate::app_state::AppState;

use super::midi_playback::stop_timidity_process;
use super::sample_catalog::ScanProgressEvent;
use super::{get_manager, CommandError};

#[tauri::command]
pub async fn export_library_database(
    folder_path: String,
    state: tauri::State<'_, AppState>,
) -> Result<LibraryExportSummary, CommandError> {
    let manager = Arc::clone(&state.manager);
    tokio::task::spawn_blocking(move || {
        manager
            .lock()
            .expect("AppState mutex poisoned")
            .export_library_database(folder_path)
            .map_err(CommandError::from)
    })
    .await
    .map_err(task_error)?
}

#[tauri::command]
pub async fn import_library_database(
    folder_path: String,
    state: tauri::State<'_, AppState>,
) -> Result<LibraryImportSummary, CommandError> {
    stop_timidity_process(&state.timidity_pid);
    let manager = Arc::clone(&state.manager);
    tokio::task::spawn_blocking(move || {
        manager
            .lock()
            .expect("AppState mutex poisoned")
            .import_library_database(folder_path)
            .map_err(CommandError::from)
    })
    .await
    .map_err(task_error)?
}

#[tauri::command]
pub async fn import_file(
    path: String,
    state: tauri::State<'_, AppState>,
) -> Result<i64, CommandError> {
    let manager = Arc::clone(&state.manager);
    tokio::task::spawn_blocking(move || {
        manager
            .lock()
            .expect("AppState mutex poisoned")
            .import_file(path)
            .map_err(CommandError::from)
    })
    .await
    .map_err(task_error)?
}

#[tauri::command]
pub fn delete_sample(
    path: String,
    state: tauri::State<'_, AppState>,
) -> Result<usize, CommandError> {
    get_manager(&state)
        .delete_sample(&path)
        .map_err(CommandError::from)
}

#[tauri::command]
pub fn clear_all_samples(state: tauri::State<'_, AppState>) -> Result<usize, CommandError> {
    get_manager(&state)
        .clear_all_samples()
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn re_scan_all_samples(
    app_handle: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<usize, CommandError> {
    let manager = Arc::clone(&state.manager);
    let handle = app_handle.clone();
    tokio::task::spawn_blocking(move || {
        manager
            .lock()
            .expect("AppState mutex poisoned")
            .re_scan_all_samples(move |progress| {
                let event = ScanProgressEvent::from(&progress);
                let _ = handle.emit("scan-progress", &event);
            })
            .map_err(CommandError::from)
    })
    .await
    .map_err(task_error)?
}

#[tauri::command]
pub async fn send_to_trash(
    path: String,
    state: tauri::State<'_, AppState>,
) -> Result<String, CommandError> {
    let manager = Arc::clone(&state.manager);
    let path_for_task = path.clone();
    tokio::task::spawn_blocking(move || {
        let manager = manager.lock().expect("AppState mutex poisoned");
        match trash::delete(&path_for_task) {
            Ok(()) => {
                let _ = manager
                    .delete_sample(&path_for_task)
                    .map_err(CommandError::from)?;
                Ok(path_for_task)
            }
            Err(error) => Err(CommandError {
                code: "io_error".to_string(),
                message: format!("failed to move to trash: {error}"),
                details: None,
            }),
        }
    })
    .await
    .map_err(task_error)?
}

#[tauri::command]
pub async fn move_sample(
    old_path: String,
    new_path: String,
    state: tauri::State<'_, AppState>,
) -> Result<String, CommandError> {
    let manager = Arc::clone(&state.manager);
    tokio::task::spawn_blocking(move || {
        manager
            .lock()
            .expect("AppState mutex poisoned")
            .move_sample(&old_path, &new_path)
            .map_err(CommandError::from)
    })
    .await
    .map_err(task_error)?
}

#[tauri::command]
pub fn update_sample_classification(
    path: String,
    playback_type: String,
    instrument_type: String,
    state: tauri::State<'_, AppState>,
) -> Result<usize, CommandError> {
    eprintln!("[update_sample_classification] INPUT: path='{path}'");
    eprintln!("[update_sample_classification] INPUT: playback_type={playback_type:?}");
    eprintln!("[update_sample_classification] INPUT: instrument_type={instrument_type:?}");
    let rows = get_manager(&state)
        .update_sample_classification(
            None,
            Some(path.as_str()),
            Some(playback_type),
            Some(instrument_type),
        )
        .map_err(CommandError::from)?;
    eprintln!("[update_sample_classification] RESULT: {rows} rows affected");
    if rows == 0 {
        return Err(not_found_error(&path));
    }
    Ok(rows)
}

#[tauri::command]
pub fn update_sample_license_metadata(
    path: String,
    source: Option<String>,
    pack_name: Option<String>,
    license: Option<String>,
    license_url: Option<String>,
    license_memo: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<usize, CommandError> {
    let rows = get_manager(&state)
        .update_sample_license_metadata(
            &path,
            source,
            pack_name,
            license,
            license_url,
            license_memo,
        )
        .map_err(CommandError::from)?;
    if rows == 0 {
        return Err(not_found_error(&path));
    }
    Ok(rows)
}

fn task_error(error: tokio::task::JoinError) -> CommandError {
    CommandError {
        code: "task_error".to_string(),
        message: error.to_string(),
        details: None,
    }
}

fn not_found_error(path: &str) -> CommandError {
    CommandError {
        code: "not_found".to_string(),
        message: format!("no sample found at path '{path}'; 0 rows updated"),
        details: Some("The sample may have been deleted or the path is incorrect.".to_string()),
    }
}
