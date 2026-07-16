use crate::app_state::AppState;

use super::{get_manager, CommandError};

#[tauri::command]
pub fn get_instrument_types(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<open_sample_manager_core::db::operations::InstrumentTypeRow>, CommandError> {
    get_manager(&state)
        .get_all_instrument_types()
        .map_err(CommandError::from)
}

#[tauri::command]
pub fn add_instrument_type(
    name: String,
    state: tauri::State<'_, AppState>,
) -> Result<i64, CommandError> {
    get_manager(&state)
        .add_instrument_type(&name)
        .map_err(CommandError::from)
}

#[tauri::command]
pub fn delete_instrument_type(
    id: i64,
    state: tauri::State<'_, AppState>,
) -> Result<usize, CommandError> {
    get_manager(&state)
        .delete_instrument_type(id)
        .map_err(CommandError::from)
}

#[tauri::command]
pub fn update_instrument_type(
    id: i64,
    name: String,
    state: tauri::State<'_, AppState>,
) -> Result<usize, CommandError> {
    get_manager(&state)
        .update_instrument_type(id, &name)
        .map_err(CommandError::from)
}
