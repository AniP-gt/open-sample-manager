// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use open_sample_manager_core::{healthcheck, SampleManager, ScanProgress, ScanStage};
use serde::Serialize;
use std::error::Error as _;
use tauri::{AppHandle, Emitter, Manager};

/// Progress event sent to frontend
#[derive(Debug, Clone, Serialize)]
struct ScanProgressEvent {
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

#[tauri::command]
fn health_check(state: tauri::State<'_, AppState>) -> HealthCheckResponse {
    let (db_ok, db_error) = match open_manager(state.db_path.as_deref()) {
        Ok(_) => (true, None),
        Err(e) => (false, Some(e)),
    };

    HealthCheckResponse {
        status: "ok".to_string(),
        core: healthcheck().to_string(),
        db_path: state
            .db_path
            .as_ref()
            .map(|p| p.to_string_lossy().to_string()),
        db_ok,
        db_error,
    }
}

#[tauri::command]
async fn scan_directory(path: String, app_handle: AppHandle, state: tauri::State<'_, AppState>) -> Result<usize, CommandError> {
    let db_path = state.db_path.clone();
    
    // Run heavy scanning work in a blocking task to avoid freezing the UI
    // Pass app_handle to emit progress events
    let result = tokio::task::spawn_blocking(move || {
        let manager = open_manager(db_path.as_deref())?;
        
        // Clone app_handle for use in the closure
        let handle = app_handle.clone();
        manager.scan_directory_with_progress(path, move |progress| {
            let event = ScanProgressEvent::from(&progress);
            let _ = handle.emit("scan-progress", &event);
        }).map_err(CommandError::from)
    })
    .await
    .map_err(|e| CommandError {
        code: "task_error".to_string(),
        message: e.to_string(),
        details: None,
    })?;
    
    result
}

#[tauri::command]
async fn import_file(path: String, state: tauri::State<'_, AppState>) -> Result<i64, CommandError> {
    let db_path = state.db_path.clone();

    let result = tokio::task::spawn_blocking(move || {
        let manager = open_manager(db_path.as_deref())?;
        // Use the core import_file helper which analyzes a single file and
        // returns the inserted row id.
        manager.import_file(path).map_err(CommandError::from)
    })
    .await
    .map_err(|e| CommandError {
        code: "task_error".to_string(),
        message: e.to_string(),
        details: None,
    })?;

    result
}

#[tauri::command]
fn search_samples(
    query: String,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<open_sample_manager_core::db::operations::SampleRow>, CommandError> {
    let manager = open_manager(state.db_path.as_deref())?;
    manager.search(&query).map_err(CommandError::from)
}

#[tauri::command]
fn get_sample(
    path: String,
    state: tauri::State<'_, AppState>,
) -> Result<Option<open_sample_manager_core::db::operations::SampleRow>, CommandError> {
    let manager = open_manager(state.db_path.as_deref())?;
    manager.get_sample(&path).map_err(CommandError::from)
}


#[tauri::command]
fn delete_sample(
    path: String,
    state: tauri::State<'_, AppState>,
) -> Result<usize, CommandError> {
    let manager = open_manager(state.db_path.as_deref())?;
    manager.delete_sample(&path).map_err(CommandError::from)
}

#[tauri::command]
fn clear_all_samples(state: tauri::State<'_, AppState>) -> Result<usize, CommandError> {
    let manager = open_manager(state.db_path.as_deref())?;
    manager.clear_all_samples().map_err(CommandError::from)
}

#[tauri::command]
async fn send_to_trash(path: String, state: tauri::State<'_, AppState>) -> Result<String, CommandError> {
    // Run the potentially blocking filesystem operation in a blocking task
    // so the async runtime isn't blocked. Also remove DB row after successful
    // trashing.
    let db_path = state.db_path.clone();
    let path_clone = path.clone();

    let result = tokio::task::spawn_blocking(move || {
        let manager = open_manager(db_path.as_deref())?;

        match trash::delete(&path_clone) {
            Ok(_) => {
                // Remove DB entry for the sample path
                let _ = manager.delete_sample(&path_clone).map_err(CommandError::from)?;
                Ok(path_clone)
            }
            Err(e) => Err(CommandError {
                code: "io_error".to_string(),
                message: format!("failed to move to trash: {}", e),
                details: None,
            }),
        }
    })
    .await
    .map_err(|e| CommandError {
        code: "task_error".to_string(),
        message: e.to_string(),
        details: None,
    })?;

    result
}

#[tauri::command]
async fn move_sample(
    old_path: String,
    new_path: String,
    state: tauri::State<'_, AppState>,
) -> Result<String, CommandError> {
    let db_path = state.db_path.clone();
    
    let result = tokio::task::spawn_blocking(move || {
        let manager = open_manager(db_path.as_deref())?;
        manager.move_sample(&old_path, &new_path).map_err(CommandError::from)
    })
    .await
    .map_err(|e| CommandError {
        code: "task_error".to_string(),
        message: e.to_string(),
        details: None,
    })?;
    
    result
}

#[tauri::command]
fn update_sample_classification(
    path: String,
    playback_type: String,
    instrument_type: String,
    state: tauri::State<'_, AppState>,
) -> Result<usize, CommandError> {
    eprintln!("[update_sample_classification] INPUT: path='{}'", path);
    eprintln!("[update_sample_classification] INPUT: playback_type={:?}", playback_type);
    eprintln!("[update_sample_classification] INPUT: instrument_type={:?}", instrument_type);
    let manager = open_manager(state.db_path.as_deref())?;
    let rows = manager
        .update_sample_classification(None, Some(path.as_str()), Some(playback_type), Some(instrument_type))
        .map_err(CommandError::from)?;
    eprintln!("[update_sample_classification] RESULT: {} rows affected", rows);
    if rows == 0 {
        return Err(CommandError {
            code: "not_found".to_string(),
            message: format!("no sample found at path '{}'; 0 rows updated", path),
            details: Some("The sample may have been deleted or the path is incorrect.".to_string()),
        });
    }
    Ok(rows)
}
#[derive(Debug, Clone)]
struct AppState {
    db_path: Option<std::path::PathBuf>,
}

#[derive(Debug, Serialize, Clone)]
struct CommandError {
    code: String,
    message: String,
    details: Option<String>,
}

impl From<open_sample_manager_core::ManagerError> for CommandError {
    fn from(value: open_sample_manager_core::ManagerError) -> Self {
        let code = match value {
            open_sample_manager_core::ManagerError::Db(_) => "db_error",
            open_sample_manager_core::ManagerError::Decode(_) => "decode_error",
            open_sample_manager_core::ManagerError::Io(_) => "io_error",
        }
        .to_string();

        let details = value.source().map(|e| e.to_string());

        Self {
            code,
            message: value.to_string(),
            details,
        }
    }
}

#[derive(Debug, Serialize, Clone)]
struct HealthCheckResponse {
    status: String,
    core: String,
    db_path: Option<String>,
    db_ok: bool,
    db_error: Option<CommandError>,
}

fn open_manager(db_path: Option<&std::path::Path>) -> Result<SampleManager, CommandError> {
    let manager = match db_path {
        Some(path) => {
            let path_str = path.to_string_lossy();
            SampleManager::new(Some(path_str.as_ref())).map_err(CommandError::from)?
        }
        None => SampleManager::new(None).map_err(CommandError::from)?,
    };
    Ok(manager)
}

#[tauri::command]
fn search_by_embedding(
    path: String,
    k: usize,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<open_sample_manager_core::db::operations::EmbeddingSearchResult>, CommandError> {
    let manager = open_manager(state.db_path.as_deref())?;

    let sample = manager
        .get_sample(&path)
        .map_err(CommandError::from)?
        .ok_or(CommandError { code: "not_found".to_string(), message: "sample not found".to_string(), details: None })?;

    let emb_blob = sample.embedding.ok_or(CommandError { code: "no_embedding".to_string(), message: "sample has no embedding".to_string(), details: None })?;
    if emb_blob.len() % 4 != 0 {
        return Err(CommandError { code: "invalid_embedding".to_string(), message: "embedding blob invalid".to_string(), details: None });
    }
    let dim = emb_blob.len() / 4;
    let mut vec: Vec<f32> = Vec::with_capacity(dim);
    for i in 0..dim {
        let off = i * 4;
        let bytes: [u8; 4] = [emb_blob[off], emb_blob[off + 1], emb_blob[off + 2], emb_blob[off + 3]];
        vec.push(f32::from_le_bytes(bytes));
    }

    let results = manager.search_by_embedding(&vec, k).map_err(CommandError::from)?;
    Ok(results)
}

/// Open folder in system file manager (Finder on macOS)
#[tauri::command]
fn open_folder(path: String) -> Result<(), String> {
    open::that(&path).map_err(|e| e.to_string())
}

/// Copy text to clipboard via Tauri plugin
#[tauri::command]
fn copy_to_clipboard(text: String, app: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_clipboard_manager::ClipboardExt;
    app.clipboard()
        .write_text(text)
        .map_err(|e| e.to_string())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(|app| {
            let db_path = match app.path().app_data_dir() {
                Ok(dir) => {
                    let _ = std::fs::create_dir_all(&dir);
                    Some(dir.join("samples.db"))
                }
                Err(_) => None,
            };

            app.manage(AppState { db_path });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            health_check,
            scan_directory,
            search_samples,
            search_by_embedding,
            get_sample,
            delete_sample,
            clear_all_samples,
    move_sample,
            send_to_trash,
            update_sample_classification,
            open_folder,
            copy_to_clipboard
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
