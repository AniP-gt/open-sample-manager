use tauri::AppHandle;

use crate::app_state::AppState;
use crate::external_commands::{self, emit_ui_command_wake as emit_ui_command_wake_event};

#[tauri::command]
pub fn claim_ui_command_queue(
    state: tauri::State<'_, AppState>,
) -> Vec<external_commands::UiCommandLease> {
    state.claim_ui_commands()
}

#[tauri::command]
pub fn acknowledge_ui_command(
    id: external_commands::UiCommandId,
    state: tauri::State<'_, AppState>,
) -> bool {
    state.acknowledge_ui_command(id)
}

#[tauri::command]
pub fn nack_ui_command(
    id: external_commands::UiCommandId,
    state: tauri::State<'_, AppState>,
) -> external_commands::NackOutcome {
    state.nack_ui_command(id)
}

#[tauri::command]
pub fn emit_ui_command_wake(app: AppHandle) -> bool {
    emit_ui_command_wake_event(&app)
}
