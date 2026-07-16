use crate::app_state::AppState;

use super::{get_manager, CommandError};

#[tauri::command]
pub fn list_collections(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<open_sample_manager_core::db::operations::CollectionRow>, CommandError> {
    get_manager(&state)
        .list_collections()
        .map_err(CommandError::from)
}

#[tauri::command]
pub fn get_collection_members(
    collection_id: i64,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<open_sample_manager_core::db::operations::SampleRow>, CommandError> {
    get_manager(&state)
        .get_collection_members(collection_id)
        .map_err(CommandError::from)
}
