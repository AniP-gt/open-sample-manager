use std::sync::Arc;

use crate::app_state::AppState;

use super::{get_manager, CommandError};

#[tauri::command]
pub async fn scan_midi_directory(
    path: String,
    state: tauri::State<'_, AppState>,
) -> Result<usize, CommandError> {
    let manager = Arc::clone(&state.manager);
    tokio::task::spawn_blocking(move || {
        manager
            .lock()
            .expect("AppState mutex poisoned")
            .scan_midi_directory(path)
            .map_err(CommandError::from)
    })
    .await
    .map_err(|error| CommandError {
        code: "task_error".to_string(),
        message: error.to_string(),
        details: None,
    })?
}

#[tauri::command]
pub fn list_midis_paginated(
    limit: usize,
    offset: usize,
    directory_path: Option<String>,
    tag_id: Option<i64>,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<open_sample_manager_core::db::operations::MidiRow>, CommandError> {
    get_manager(&state)
        .list_midis_paginated(limit, offset, directory_path.as_deref(), tag_id)
        .map_err(CommandError::from)
}

#[tauri::command]
pub fn list_midis_around_id(
    target_id: i64,
    limit: usize,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<open_sample_manager_core::db::operations::MidiRow>, CommandError> {
    get_manager(&state)
        .list_midis_around_id(target_id, limit)
        .map_err(CommandError::from)
}

#[tauri::command]
pub fn get_all_midi_paths(state: tauri::State<'_, AppState>) -> Result<Vec<String>, CommandError> {
    get_manager(&state)
        .get_all_midi_paths()
        .map_err(CommandError::from)
}

#[tauri::command]
pub fn get_midi(
    path: String,
    state: tauri::State<'_, AppState>,
) -> Result<Option<open_sample_manager_core::db::operations::MidiRow>, CommandError> {
    get_manager(&state)
        .get_midi(&path)
        .map_err(CommandError::from)
}

#[tauri::command]
pub fn delete_midi(path: String, state: tauri::State<'_, AppState>) -> Result<usize, CommandError> {
    get_manager(&state)
        .delete_midi(&path)
        .map_err(CommandError::from)
}

#[tauri::command]
pub fn clear_all_midis(state: tauri::State<'_, AppState>) -> Result<usize, CommandError> {
    get_manager(&state)
        .clear_all_midis()
        .map_err(CommandError::from)
}

#[tauri::command]
pub fn search_midis(
    query: String,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<open_sample_manager_core::db::operations::MidiRow>, CommandError> {
    get_manager(&state)
        .search_midis(&query)
        .map_err(CommandError::from)
}

#[tauri::command]
pub fn search_midis_paginated(
    query: String,
    limit: usize,
    offset: usize,
    directory_path: Option<String>,
    tag_id: Option<i64>,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<open_sample_manager_core::db::operations::MidiRow>, CommandError> {
    get_manager(&state)
        .search_midis_paginated(&query, limit, offset, directory_path.as_deref(), tag_id)
        .map_err(CommandError::from)
}
