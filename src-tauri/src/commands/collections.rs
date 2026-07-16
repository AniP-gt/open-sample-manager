use crate::app_state::AppState;

use super::{get_manager, CommandError};

#[tauri::command]
pub fn create_collection(
    name: String,
    description: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<open_sample_manager_core::db::operations::CollectionRow, CommandError> {
    get_manager(&state)
        .create_collection(name, description)
        .map_err(CommandError::from)
}

#[tauri::command]
pub fn list_collections(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<open_sample_manager_core::db::operations::CollectionRow>, CommandError> {
    get_manager(&state)
        .list_collections()
        .map_err(CommandError::from)
}

#[tauri::command]
pub fn update_collection(
    id: i64,
    name: String,
    description: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<Option<open_sample_manager_core::db::operations::CollectionRow>, CommandError> {
    get_manager(&state)
        .update_collection(id, name, description)
        .map_err(CommandError::from)
}

#[tauri::command]
pub fn delete_collection(
    id: i64,
    state: tauri::State<'_, AppState>,
) -> Result<usize, CommandError> {
    get_manager(&state)
        .delete_collection(id)
        .map_err(CommandError::from)
}

#[tauri::command]
pub fn add_samples_to_collection(
    collection_id: i64,
    sample_ids: Vec<i64>,
    state: tauri::State<'_, AppState>,
) -> Result<usize, CommandError> {
    get_manager(&state)
        .add_samples_to_collection_by_id(collection_id, sample_ids)
        .map_err(CommandError::from)
}

#[tauri::command]
pub fn remove_samples_from_collection(
    collection_id: i64,
    sample_ids: Vec<i64>,
    state: tauri::State<'_, AppState>,
) -> Result<usize, CommandError> {
    get_manager(&state)
        .remove_samples_from_collection(collection_id, sample_ids)
        .map_err(CommandError::from)
}

#[tauri::command]
pub fn list_collection_samples(
    collection_id: i64,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<open_sample_manager_core::db::operations::SampleRow>, CommandError> {
    get_manager(&state)
        .list_collection_samples(collection_id)
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

#[tauri::command]
pub fn create_saved_search(
    input: open_sample_manager_core::db::operations::SavedSearchInput,
    state: tauri::State<'_, AppState>,
) -> Result<open_sample_manager_core::db::operations::SavedSearchRow, CommandError> {
    get_manager(&state)
        .create_saved_search(input)
        .map_err(CommandError::from)
}

#[tauri::command]
pub fn list_saved_searches(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<open_sample_manager_core::db::operations::SavedSearchRow>, CommandError> {
    get_manager(&state)
        .list_saved_searches()
        .map_err(CommandError::from)
}

#[tauri::command]
pub fn update_saved_search(
    id: i64,
    input: open_sample_manager_core::db::operations::SavedSearchInput,
    state: tauri::State<'_, AppState>,
) -> Result<Option<open_sample_manager_core::db::operations::SavedSearchRow>, CommandError> {
    get_manager(&state)
        .update_saved_search(id, input)
        .map_err(CommandError::from)
}

#[tauri::command]
pub fn delete_saved_search(
    id: i64,
    state: tauri::State<'_, AppState>,
) -> Result<usize, CommandError> {
    get_manager(&state)
        .delete_saved_search(id)
        .map_err(CommandError::from)
}
