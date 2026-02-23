// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use open_sample_manager_core::{healthcheck, SampleManager};
use serde::Serialize;
use std::error::Error as _;
use tauri::Manager;

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
fn scan_directory(path: String, state: tauri::State<'_, AppState>) -> Result<usize, CommandError> {
    let manager = open_manager(state.db_path.as_deref())?;
    manager.scan_directory(path).map_err(CommandError::from)
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

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
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
            get_sample
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
