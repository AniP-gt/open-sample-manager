use crate::app_state::AppState;

use super::{get_manager, CommandError};

#[tauri::command]
pub fn get_midi_tags(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<open_sample_manager_core::db::operations::MidiTagRow>, CommandError> {
    get_manager(&state)
        .get_all_midi_tags()
        .map_err(CommandError::from)
}

#[tauri::command]
pub fn add_midi_tag(name: String, state: tauri::State<'_, AppState>) -> Result<i64, CommandError> {
    get_manager(&state)
        .add_midi_tag(&name)
        .map_err(CommandError::from)
}

#[tauri::command]
pub fn delete_midi_tag(id: i64, state: tauri::State<'_, AppState>) -> Result<usize, CommandError> {
    get_manager(&state)
        .delete_midi_tag(id)
        .map_err(CommandError::from)
}

#[tauri::command]
pub fn update_midi_tag(
    id: i64,
    name: String,
    state: tauri::State<'_, AppState>,
) -> Result<usize, CommandError> {
    get_manager(&state)
        .update_midi_tag(id, &name)
        .map_err(CommandError::from)
}

#[tauri::command]
pub fn set_midi_file_tag(
    midi_id: i64,
    tag_id: Option<i64>,
    state: tauri::State<'_, AppState>,
) -> Result<(), CommandError> {
    get_manager(&state)
        .set_midi_file_tag(midi_id, tag_id)
        .map_err(CommandError::from)
}

#[tauri::command]
pub fn get_midi_file_tags(
    midi_id: i64,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<open_sample_manager_core::db::operations::MidiTagRow>, CommandError> {
    get_manager(&state)
        .get_midi_file_tags(midi_id)
        .map_err(CommandError::from)
}
