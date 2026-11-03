use super::{get_manager, CommandError};
use crate::app_state::AppState;
use open_sample_manager_core::manager::discovery::{
    DiscoveryError, DiscoveryQuery, DiscoveryRow, ProjectMemberUpdate, SmartCollection, SmartRules,
    UsageKind,
};

impl From<DiscoveryError> for CommandError {
    fn from(error: DiscoveryError) -> Self {
        Self {
            code: "discovery_error".into(),
            message: error.to_string(),
            details: None,
        }
    }
}

#[tauri::command]
pub fn record_sample_usage(
    sample_id: i64,
    kind: UsageKind,
    state: tauri::State<'_, AppState>,
) -> Result<bool, CommandError> {
    Ok(get_manager(&state).record_sample_usage(sample_id, kind)?)
}

#[tauri::command]
pub fn record_sample_export(
    path: String,
    state: tauri::State<'_, AppState>,
) -> Result<bool, CommandError> {
    let manager = get_manager(&state);
    match manager.get_sample(&path).map_err(CommandError::from)? {
        Some(sample) => Ok(manager.record_sample_usage(sample.id, UsageKind::Export)?),
        None => Ok(false),
    }
}

#[tauri::command]
pub async fn query_discovery(
    query: DiscoveryQuery,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<DiscoveryRow>, CommandError> {
    let manager = state.manager.clone();
    tokio::task::spawn_blocking(move || {
        let guard = manager.lock().map_err(|e| CommandError {
            code: "lock_error".into(),
            message: e.to_string(),
            details: None,
        })?;
        guard.query_discovery(&query).map_err(CommandError::from)
    })
    .await
    .map_err(|e| CommandError {
        code: "task_error".into(),
        message: e.to_string(),
        details: None,
    })?
}

#[tauri::command]
pub fn create_project_shelf(
    name: String,
    state: tauri::State<'_, AppState>,
) -> Result<i64, CommandError> {
    Ok(get_manager(&state).create_project_shelf(&name)?)
}

#[tauri::command]
pub fn update_project_member(
    update: ProjectMemberUpdate,
    state: tauri::State<'_, AppState>,
) -> Result<(), CommandError> {
    Ok(get_manager(&state).update_project_member(&update)?)
}

#[tauri::command]
pub fn remove_project_member(
    collection_id: i64,
    sample_id: i64,
    state: tauri::State<'_, AppState>,
) -> Result<(), CommandError> {
    Ok(get_manager(&state).remove_project_member(collection_id, sample_id)?)
}

#[tauri::command]
pub fn list_smart_collections(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<SmartCollection>, CommandError> {
    Ok(get_manager(&state).list_smart_collections()?)
}

#[tauri::command]
pub fn save_smart_collection(
    name: String,
    rules: SmartRules,
    state: tauri::State<'_, AppState>,
) -> Result<(), CommandError> {
    Ok(get_manager(&state).save_smart_collection(&name, &rules)?)
}

#[tauri::command]
pub fn delete_smart_collection(
    id: i64,
    state: tauri::State<'_, AppState>,
) -> Result<(), CommandError> {
    Ok(get_manager(&state).delete_smart_collection(id)?)
}
