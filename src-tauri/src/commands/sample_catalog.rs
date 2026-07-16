use open_sample_manager_core::{healthcheck, ScanProgress, ScanStage};
use serde::Serialize;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};

use crate::app_state::AppState;

use super::{get_manager, CommandError};

#[derive(Debug, Serialize, Clone)]
pub(crate) struct ScanProgressEvent {
    stage: String,
    current: usize,
    total: usize,
    current_file: String,
}

impl From<&ScanProgress> for ScanProgressEvent {
    fn from(progress: &ScanProgress) -> Self {
        let stage = match progress.stage {
            ScanStage::Discovering => "discovering".to_string(),
            ScanStage::Analyzing => "analyzing".to_string(),
            ScanStage::Complete => "complete".to_string(),
        };
        Self {
            stage,
            current: progress.current,
            total: progress.total,
            current_file: progress.current_file.clone(),
        }
    }
}

#[derive(Debug, Serialize, Clone)]
pub(crate) struct HealthCheckResponse {
    status: String,
    core: String,
    db_path: Option<String>,
    db_ok: bool,
    db_error: Option<CommandError>,
}

#[tauri::command]
pub fn health_check(state: tauri::State<'_, AppState>) -> HealthCheckResponse {
    let (db_ok, db_error) = match state.manager.lock() {
        Ok(_) => (true, None),
        Err(error) => (
            false,
            Some(CommandError {
                code: "db_error".to_string(),
                message: format!("mutex poisoned: {error}"),
                details: None,
            }),
        ),
    };

    HealthCheckResponse {
        status: "ok".to_string(),
        core: healthcheck().to_string(),
        db_path: None,
        db_ok,
        db_error,
    }
}

#[tauri::command]
pub async fn scan_directory(
    path: String,
    app_handle: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<usize, CommandError> {
    let manager = Arc::clone(&state.manager);
    tokio::task::spawn_blocking(move || {
        let manager = manager.lock().expect("AppState mutex poisoned");
        let handle = app_handle.clone();
        manager
            .scan_directory_with_progress(path, move |progress| {
                let event = ScanProgressEvent::from(&progress);
                let _ = handle.emit("scan-progress", &event);
            })
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
pub fn search_samples(
    query: String,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<open_sample_manager_core::db::operations::SampleRow>, CommandError> {
    get_manager(&state)
        .search(&query)
        .map_err(CommandError::from)
}

#[tauri::command]
pub fn list_samples_paginated(
    query: Option<String>,
    limit: usize,
    offset: usize,
    directory_path: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<open_sample_manager_core::db::operations::SampleRow>, CommandError> {
    let manager = get_manager(&state);
    let directory_path = directory_path.as_deref();
    match query {
        Some(query) => manager
            .search_paginated(&query, limit, offset, directory_path)
            .map_err(CommandError::from),
        None => manager
            .list_samples_paginated(limit, offset, directory_path)
            .map_err(CommandError::from),
    }
}

#[tauri::command]
pub fn list_samples_around_id(
    target_id: i64,
    limit: usize,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<open_sample_manager_core::db::operations::SampleRow>, CommandError> {
    get_manager(&state)
        .list_samples_around_id(target_id, limit)
        .map_err(CommandError::from)
}

#[tauri::command]
pub fn get_sample(
    path: String,
    state: tauri::State<'_, AppState>,
) -> Result<Option<open_sample_manager_core::db::operations::SampleRow>, CommandError> {
    get_manager(&state)
        .get_sample(&path)
        .map_err(CommandError::from)
}

#[tauri::command]
pub fn get_samples_by_ids(
    sample_ids: Vec<i64>,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<open_sample_manager_core::db::operations::SampleRow>, CommandError> {
    let manager = get_manager(&state);
    sample_ids
        .into_iter()
        .map(|sample_id| {
            manager
                .get_sample_by_id(sample_id)
                .map_err(CommandError::from)?
                .ok_or(CommandError {
                    code: "not_found".to_string(),
                    message: "sample not found".to_string(),
                    details: None,
                })
        })
        .collect()
}

#[tauri::command]
pub fn list_all_sample_paths(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<String>, CommandError> {
    get_manager(&state)
        .get_all_sample_paths()
        .map_err(CommandError::from)
}

#[tauri::command]
pub fn list_duplicate_groups(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<open_sample_manager_core::db::operations::DuplicateGroup>, CommandError> {
    get_manager(&state)
        .list_duplicate_groups()
        .map_err(CommandError::from)
}

#[tauri::command]
pub fn search_by_embedding(
    path: String,
    k: usize,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<open_sample_manager_core::db::operations::EmbeddingSearchResult>, CommandError> {
    let manager = get_manager(&state);
    let sample = manager
        .get_sample(&path)
        .map_err(CommandError::from)?
        .ok_or(CommandError {
            code: "not_found".to_string(),
            message: "sample not found".to_string(),
            details: None,
        })?;
    let embedding = sample.embedding.ok_or(CommandError {
        code: "no_embedding".to_string(),
        message: "sample has no embedding".to_string(),
        details: None,
    })?;
    if embedding.len() % 4 != 0 {
        return Err(CommandError {
            code: "invalid_embedding".to_string(),
            message: "embedding blob invalid".to_string(),
            details: None,
        });
    }
    let vector = embedding
        .chunks_exact(4)
        .map(|bytes| f32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]))
        .collect::<Vec<_>>();
    manager
        .search_by_embedding(&vector, k)
        .map_err(CommandError::from)
}
