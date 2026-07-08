// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use open_sample_manager_core::analysis::processed_wav::{render_processed_wav, ProcessedWavError};
use open_sample_manager_core::{
    healthcheck, LibraryExportSummary, LibraryImportSummary, ProcessedSampleRenderSeconds,
    SampleManager, ScanProgress, ScanStage,
};
use serde::Serialize;
use std::collections::HashSet;
use std::error::Error as _;
use std::io::Write as _;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter, Manager};

const MAX_MIDI_PREVIEW_BYTES: u64 = 10 * 1024 * 1024;

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
    // If we can lock the manager, the DB is OK
    let (db_ok, db_error) = match state.manager.lock() {
        Ok(_) => (true, None),
        Err(e) => (
            false,
            Some(CommandError {
                code: "db_error".to_string(),
                message: format!("mutex poisoned: {}", e),
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
async fn scan_directory(
    path: String,
    app_handle: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<usize, CommandError> {
    let mgr = Arc::clone(&state.manager);

    // Run heavy scanning work in a blocking task to avoid freezing the UI
    // Pass app_handle to emit progress events
    let result = tokio::task::spawn_blocking(move || {
        let manager = mgr.lock().expect("AppState mutex poisoned");

        // Clone app_handle for use in the closure
        let handle = app_handle.clone();
        manager
            .scan_directory_with_progress(path, move |progress| {
                let event = ScanProgressEvent::from(&progress);
                let _ = handle.emit("scan-progress", &event);
            })
            .map_err(CommandError::from)
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
async fn export_library_database(
    folder_path: String,
    state: tauri::State<'_, AppState>,
) -> Result<LibraryExportSummary, CommandError> {
    let mgr = Arc::clone(&state.manager);

    let result = tokio::task::spawn_blocking(move || {
        let manager = mgr.lock().expect("AppState mutex poisoned");
        manager
            .export_library_database(folder_path)
            .map_err(CommandError::from)
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
async fn import_library_database(
    folder_path: String,
    state: tauri::State<'_, AppState>,
) -> Result<LibraryImportSummary, CommandError> {
    stop_timidity_process(&state.timidity_pid);
    let mgr = Arc::clone(&state.manager);

    let result = tokio::task::spawn_blocking(move || {
        let mut manager = mgr.lock().expect("AppState mutex poisoned");
        manager
            .import_library_database(folder_path)
            .map_err(CommandError::from)
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
    let mgr = Arc::clone(&state.manager);

    let result = tokio::task::spawn_blocking(move || {
        let manager = mgr.lock().expect("AppState mutex poisoned");
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
    let manager = get_manager(&state);
    manager.search(&query).map_err(CommandError::from)
}

#[tauri::command]
fn list_samples_paginated(
    query: Option<String>,
    limit: usize,
    offset: usize,
    directory_path: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<open_sample_manager_core::db::operations::SampleRow>, CommandError> {
    let manager = get_manager(&state);
    let directory_path = directory_path.as_deref();
    match query {
        Some(q) => manager
            .search_paginated(&q, limit, offset, directory_path)
            .map_err(CommandError::from),
        None => manager
            .list_samples_paginated(limit, offset, directory_path)
            .map_err(CommandError::from),
    }
}

#[tauri::command]
fn list_samples_around_id(
    target_id: i64,
    limit: usize,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<open_sample_manager_core::db::operations::SampleRow>, CommandError> {
    let manager = get_manager(&state);
    manager
        .list_samples_around_id(target_id, limit)
        .map_err(CommandError::from)
}

#[tauri::command]
fn get_sample(
    path: String,
    state: tauri::State<'_, AppState>,
) -> Result<Option<open_sample_manager_core::db::operations::SampleRow>, CommandError> {
    let manager = get_manager(&state);
    manager.get_sample(&path).map_err(CommandError::from)
}

#[tauri::command]
fn list_all_sample_paths(state: tauri::State<'_, AppState>) -> Result<Vec<String>, CommandError> {
    let manager = get_manager(&state);
    manager.get_all_sample_paths().map_err(CommandError::from)
}

#[tauri::command]
fn list_duplicate_groups(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<open_sample_manager_core::db::operations::DuplicateGroup>, CommandError> {
    let manager = get_manager(&state);
    manager.list_duplicate_groups().map_err(CommandError::from)
}

#[tauri::command]
fn delete_sample(path: String, state: tauri::State<'_, AppState>) -> Result<usize, CommandError> {
    let manager = get_manager(&state);
    manager.delete_sample(&path).map_err(CommandError::from)
}

#[tauri::command]
fn clear_all_samples(state: tauri::State<'_, AppState>) -> Result<usize, CommandError> {
    let manager = get_manager(&state);
    manager.clear_all_samples().map_err(CommandError::from)
}

#[tauri::command]
async fn re_scan_all_samples(
    app_handle: AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<usize, CommandError> {
    let mgr = Arc::clone(&state.manager);
    let handle = app_handle.clone();

    let result = tokio::task::spawn_blocking(move || {
        let manager = mgr.lock().expect("AppState mutex poisoned");
        manager
            .re_scan_all_samples(move |prog| {
                let event = ScanProgressEvent::from(&prog);
                let _ = handle.emit("scan-progress", &event);
            })
            .map_err(CommandError::from)
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
async fn send_to_trash(
    path: String,
    state: tauri::State<'_, AppState>,
) -> Result<String, CommandError> {
    // Run the potentially blocking filesystem operation in a blocking task
    // so the async runtime isn't blocked. Also remove DB row after successful
    // trashing.
    let mgr = Arc::clone(&state.manager);
    let path_clone = path.clone();

    let result = tokio::task::spawn_blocking(move || {
        let manager = mgr.lock().expect("AppState mutex poisoned");

        match trash::delete(&path_clone) {
            Ok(_) => {
                // Remove DB entry for the sample path
                let _ = manager
                    .delete_sample(&path_clone)
                    .map_err(CommandError::from)?;
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

/// Prepare a filesystem-backed copy of a sample for dragging to external apps.
/// Some samples may be stored in locations not directly accessible to other
/// applications (e.g. packaged resources or virtual blobs). This command
/// copies the file to the system temporary directory and returns the absolute
/// path which can be used as a `file://` URI on the renderer side.
#[tauri::command]
async fn prepare_drag_file(
    path: String,
    state: tauri::State<'_, AppState>,
) -> Result<String, CommandError> {
    let prepared_temp_paths = Arc::clone(&state.prepared_temp_paths);
    tokio::task::spawn_blocking(move || {
        let src = Path::new(&path);
        if !src.exists() {
            return Err(CommandError {
                code: "not_found".to_string(),
                message: format!("source path does not exist: {}", path),
                details: None,
            });
        }

        let target = copy_to_prepared_temp_file(src)?;
        register_prepared_temp_path(&prepared_temp_paths, &target)?;
        Ok(target.to_string_lossy().to_string())
    })
    .await
    .map_err(|e| CommandError {
        code: "task_error".to_string(),
        message: e.to_string(),
        details: None,
    })?
}

#[tauri::command]
async fn prepare_processed_drag_file(
    path: String,
    params: ProcessedSampleRenderSeconds,
    state: tauri::State<'_, AppState>,
) -> Result<String, CommandError> {
    let prepared_temp_paths = Arc::clone(&state.prepared_temp_paths);
    tokio::task::spawn_blocking(move || {
        let source = PathBuf::from(&path);
        if !source.exists() {
            return Err(CommandError {
                code: "not_found".to_string(),
                message: format!("source path does not exist: {}", path),
                details: None,
            });
        }

        let output_path = processed_drag_output_path(&source)?;
        render_processed_wav(&source, &output_path, params).map_err(CommandError::from)?;
        register_prepared_temp_path(&prepared_temp_paths, &output_path)?;
        Ok(output_path.to_string_lossy().to_string())
    })
    .await
    .map_err(|e| CommandError {
        code: "task_error".to_string(),
        message: e.to_string(),
        details: None,
    })?
}

#[tauri::command]
fn delete_file(path: String, state: tauri::State<'_, AppState>) -> Result<(), CommandError> {
    delete_registered_temp_file(&path, &state.prepared_temp_paths)
}

fn delete_registered_temp_file(
    path: impl AsRef<Path>,
    prepared_temp_paths: &PreparedTempRegistry,
) -> Result<(), CommandError> {
    let target = PathBuf::from(path.as_ref());
    let canonical_target = target.canonicalize().map_err(|e| CommandError {
        code: "io_error".to_string(),
        message: format!("failed to resolve path for deletion: {}", e),
        details: None,
    })?;

    let registered = {
        let paths = prepared_temp_paths
            .lock()
            .expect("prepared temp registry mutex poisoned");
        paths.contains(&canonical_target)
    };

    if !registered {
        return Err(CommandError {
            code: "invalid_path".to_string(),
            message: "delete_file only removes app-created prepared drag files".to_string(),
            details: None,
        });
    }

    if canonical_target.is_file() {
        std::fs::remove_file(&canonical_target).map_err(|e| CommandError {
            code: "io_error".to_string(),
            message: format!("failed to delete temp file: {}", e),
            details: None,
        })?;
    }

    prepared_temp_paths
        .lock()
        .expect("prepared temp registry mutex poisoned")
        .remove(&canonical_target);

    Ok(())
}

type PreparedTempRegistry = Arc<Mutex<HashSet<PathBuf>>>;

fn register_prepared_temp_path(
    prepared_temp_paths: &PreparedTempRegistry,
    path: &Path,
) -> Result<(), CommandError> {
    let canonical_path = path.canonicalize().map_err(|e| CommandError {
        code: "io_error".to_string(),
        message: format!("failed to register prepared drag file: {}", e),
        details: None,
    })?;
    prepared_temp_paths
        .lock()
        .expect("prepared temp registry mutex poisoned")
        .insert(canonical_path);
    Ok(())
}

fn copy_to_prepared_temp_file(source: &Path) -> Result<PathBuf, CommandError> {
    let target = prepared_drag_output_path(source, None)?;
    let mut source_file = std::fs::File::open(source).map_err(|e| CommandError {
        code: "io_error".to_string(),
        message: format!("failed to open drag source file: {}", e),
        details: None,
    })?;
    let mut target_file = std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&target)
        .map_err(|e| CommandError {
            code: "io_error".to_string(),
            message: format!("failed to create prepared drag file: {}", e),
            details: None,
        })?;

    if let Err(error) = std::io::copy(&mut source_file, &mut target_file) {
        let _ = std::fs::remove_file(&target);
        return Err(CommandError {
            code: "io_error".to_string(),
            message: format!("failed to prepare drag file: {}", error),
            details: None,
        });
    }

    Ok(target)
}

fn processed_drag_output_path(source: &Path) -> Result<PathBuf, CommandError> {
    prepared_drag_output_path(source, Some("wav"))
}

fn prepared_drag_output_path(
    source: &Path,
    extension_override: Option<&str>,
) -> Result<PathBuf, CommandError> {
    let output_dir = app_drag_temp_dir()?;
    std::fs::create_dir_all(&output_dir).map_err(|e| CommandError {
        code: "io_error".to_string(),
        message: format!("failed to create drag temp directory: {}", e),
        details: None,
    })?;

    let stem = source
        .file_stem()
        .and_then(|value| value.to_str())
        .filter(|value| !value.is_empty())
        .unwrap_or("sample");
    let extension =
        extension_override.or_else(|| source.extension().and_then(|value| value.to_str()));
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or(0);
    let process_id = std::process::id();

    let mut output_path = output_dir;
    match extension {
        Some(extension) if !extension.is_empty() => {
            output_path.push(format!("{stem}-{process_id}-{timestamp}.{extension}"));
        }
        _ => output_path.push(format!("{stem}-{process_id}-{timestamp}")),
    }
    Ok(output_path)
}

fn app_drag_temp_dir() -> Result<PathBuf, CommandError> {
    let mut output_dir = std::env::temp_dir();
    output_dir.push("open-sample-manager-drag");
    Ok(output_dir)
}

#[cfg(test)]
mod prepared_temp_tests {
    use super::{delete_registered_temp_file, PreparedTempRegistry};
    use std::collections::HashSet;
    use std::sync::{Arc, Mutex};

    #[test]
    fn delete_registered_temp_file_rejects_unregistered_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("unregistered.wav");
        std::fs::write(&path, b"not app-created").unwrap();
        let registry: PreparedTempRegistry = Arc::new(Mutex::new(HashSet::new()));

        let error = delete_registered_temp_file(&path, &registry).unwrap_err();

        assert_eq!(error.code, "invalid_path");
        assert!(path.exists());
    }

    #[test]
    fn delete_registered_temp_file_removes_registered_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("registered.wav");
        std::fs::write(&path, b"app-created").unwrap();
        let canonical_path = path.canonicalize().unwrap();
        let registry: PreparedTempRegistry = Arc::new(Mutex::new(HashSet::new()));
        registry.lock().unwrap().insert(canonical_path);

        delete_registered_temp_file(&path, &registry).unwrap();

        assert!(!path.exists());
        assert!(registry.lock().unwrap().is_empty());
    }
}

/// Return an absolute filesystem path to a small drag-cursor PNG icon.
/// The icon is written to the system temp directory on first call and
/// reused on subsequent calls. This path is required by tauri-plugin-drag's
/// `Options.icon` field, which must be a real file path (not base64).
#[tauri::command]
fn get_drag_icon_path() -> Result<String, CommandError> {
    // Minimal 1×1 transparent PNG (68 bytes, PNG spec compliant).
    // This avoids shipping a binary asset just for the drag cursor.
    #[rustfmt::skip]
    const TRANSPARENT_PNG_1X1: &[u8] = &[
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk len + type
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // width=1, height=1
        0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, // 8-bit RGBA, CRC
        0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41, // IDAT chunk
        0x54, 0x78, 0x9C, 0x62, 0x00, 0x00, 0x00, 0x02, // zlib data
        0x00, 0x01, 0xE2, 0x21, 0xBC, 0x33, 0x00, 0x00, // CRC + IEND len
        0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, // IEND type
        0x60, 0x82,                                       // IEND CRC
    ];

    let mut path = std::env::temp_dir();
    path.push("osm_drag_icon.png");

    // Only write if not already present (avoid redundant I/O)
    if !path.exists() {
        std::fs::write(&path, TRANSPARENT_PNG_1X1).map_err(|e| CommandError {
            code: "io_error".to_string(),
            message: format!("failed to write drag icon: {}", e),
            details: None,
        })?;
    }

    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
fn debug_start_drag(raw: serde_json::Value) -> Result<(), CommandError> {
    // One-line debug helper: print the raw JSON payload the renderer attempted
    // to send to the plugin's start_drag command. This helps diagnose serde
    // deserialization errors without modifying plugin internals. We'll keep
    // this lightweight and remove it once we've captured logs.
    eprintln!("[debug_start_drag] raw payload: {}", raw);
    Ok(())
}

// Helper structs matching typical shapes we might receive from the renderer.
#[allow(dead_code)]
#[derive(serde::Deserialize, Debug)]
struct CandidateFiles {
    files: Vec<String>,
}

#[allow(dead_code)]
#[derive(serde::Deserialize, Debug)]
struct CandidateFilesCapital {
    #[serde(rename = "Files")]
    files: Vec<String>,
}

#[allow(dead_code)]
#[derive(serde::Deserialize, Debug)]
struct CandidateItemArray(Vec<String>);

#[allow(dead_code)]
#[derive(serde::Deserialize, Debug)]
struct CandidateImageFile {
    #[serde(rename = "File")]
    file: String,
}

#[allow(dead_code)]
#[derive(serde::Deserialize, Debug)]
struct CandidateImagePath {
    path: String,
}

#[tauri::command]
fn debug_try_deserialize(raw: serde_json::Value) -> Result<String, CommandError> {
    // Try several candidate shapes and report which ones succeed
    let mut successes: Vec<String> = Vec::new();
    let mut failures: Vec<String> = Vec::new();

    // 1) item as simple array: ["/abs/path"]
    match serde_json::from_value::<CandidateItemArray>(raw.clone()) {
        Ok(v) => successes.push(format!("CandidateItemArray -> {:?}", v)),
        Err(e) => failures.push(format!("CandidateItemArray: {}", e)),
    }

    // 2) { files: [...] }
    match serde_json::from_value::<CandidateFiles>(raw.clone()) {
        Ok(v) => successes.push(format!("CandidateFiles -> {:?}", v)),
        Err(e) => failures.push(format!("CandidateFiles: {}", e)),
    }

    // 3) { Files: [...] }
    match serde_json::from_value::<CandidateFilesCapital>(raw.clone()) {
        Ok(v) => successes.push(format!("CandidateFilesCapital -> {:?}", v)),
        Err(e) => failures.push(format!("CandidateFilesCapital: {}", e)),
    }

    // 4) image: { File: "/path" }
    match serde_json::from_value::<CandidateImageFile>(raw.clone()) {
        Ok(v) => successes.push(format!("CandidateImageFile -> {:?}", v)),
        Err(e) => failures.push(format!("CandidateImageFile: {}", e)),
    }

    // 5) image: { path: "/path" }
    match serde_json::from_value::<CandidateImagePath>(raw.clone()) {
        Ok(v) => successes.push(format!("CandidateImagePath -> {:?}", v)),
        Err(e) => failures.push(format!("CandidateImagePath: {}", e)),
    }

    eprintln!("[debug_try_deserialize] successes: {:?}", successes);
    eprintln!("[debug_try_deserialize] failures: {:?}", failures);

    Ok(format!(
        "successes: {}, failures: {}",
        successes.len(),
        failures.len()
    ))
}

// (start_native_drag wrapper removed) Renderer should call `native_drag_out`
// directly via `invoke("native_drag_out", { archive_path, file_paths, target_dir })`.

#[tauri::command]
async fn move_sample(
    old_path: String,
    new_path: String,
    state: tauri::State<'_, AppState>,
) -> Result<String, CommandError> {
    let mgr = Arc::clone(&state.manager);

    let result = tokio::task::spawn_blocking(move || {
        let manager = mgr.lock().expect("AppState mutex poisoned");
        manager
            .move_sample(&old_path, &new_path)
            .map_err(CommandError::from)
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
    eprintln!(
        "[update_sample_classification] INPUT: playback_type={:?}",
        playback_type
    );
    eprintln!(
        "[update_sample_classification] INPUT: instrument_type={:?}",
        instrument_type
    );
    let manager = get_manager(&state);
    let rows = manager
        .update_sample_classification(
            None,
            Some(path.as_str()),
            Some(playback_type),
            Some(instrument_type),
        )
        .map_err(CommandError::from)?;
    eprintln!(
        "[update_sample_classification] RESULT: {} rows affected",
        rows
    );
    if rows == 0 {
        return Err(CommandError {
            code: "not_found".to_string(),
            message: format!("no sample found at path '{}'; 0 rows updated", path),
            details: Some("The sample may have been deleted or the path is incorrect.".to_string()),
        });
    }
    Ok(rows)
}

#[tauri::command]
fn create_collection(
    name: String,
    description: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<open_sample_manager_core::db::operations::CollectionRow, CommandError> {
    get_manager(&state)
        .create_collection(name, description)
        .map_err(CommandError::from)
}

#[tauri::command]
fn list_collections(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<open_sample_manager_core::db::operations::CollectionRow>, CommandError> {
    get_manager(&state)
        .list_collections()
        .map_err(CommandError::from)
}

#[tauri::command]
fn update_collection(
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
fn delete_collection(id: i64, state: tauri::State<'_, AppState>) -> Result<usize, CommandError> {
    get_manager(&state)
        .delete_collection(id)
        .map_err(CommandError::from)
}

#[tauri::command]
fn add_samples_to_collection(
    collection_id: i64,
    sample_ids: Vec<i64>,
    state: tauri::State<'_, AppState>,
) -> Result<usize, CommandError> {
    get_manager(&state)
        .add_samples_to_collection(collection_id, sample_ids)
        .map_err(CommandError::from)
}

#[tauri::command]
fn remove_samples_from_collection(
    collection_id: i64,
    sample_ids: Vec<i64>,
    state: tauri::State<'_, AppState>,
) -> Result<usize, CommandError> {
    get_manager(&state)
        .remove_samples_from_collection(collection_id, sample_ids)
        .map_err(CommandError::from)
}

#[tauri::command]
fn list_collection_samples(
    collection_id: i64,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<open_sample_manager_core::db::operations::SampleRow>, CommandError> {
    get_manager(&state)
        .list_collection_samples(collection_id)
        .map_err(CommandError::from)
}

#[tauri::command]
fn create_saved_search(
    input: open_sample_manager_core::db::operations::SavedSearchInput,
    state: tauri::State<'_, AppState>,
) -> Result<open_sample_manager_core::db::operations::SavedSearchRow, CommandError> {
    get_manager(&state)
        .create_saved_search(input)
        .map_err(CommandError::from)
}

#[tauri::command]
fn list_saved_searches(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<open_sample_manager_core::db::operations::SavedSearchRow>, CommandError> {
    get_manager(&state)
        .list_saved_searches()
        .map_err(CommandError::from)
}

#[tauri::command]
fn update_saved_search(
    id: i64,
    input: open_sample_manager_core::db::operations::SavedSearchInput,
    state: tauri::State<'_, AppState>,
) -> Result<Option<open_sample_manager_core::db::operations::SavedSearchRow>, CommandError> {
    get_manager(&state)
        .update_saved_search(id, input)
        .map_err(CommandError::from)
}

#[tauri::command]
fn delete_saved_search(id: i64, state: tauri::State<'_, AppState>) -> Result<usize, CommandError> {
    get_manager(&state)
        .delete_saved_search(id)
        .map_err(CommandError::from)
}

#[tauri::command]
fn update_sample_license_metadata(
    path: String,
    source: Option<String>,
    pack_name: Option<String>,
    license: Option<String>,
    license_url: Option<String>,
    license_memo: Option<String>,
    state: tauri::State<'_, AppState>,
) -> Result<usize, CommandError> {
    let manager = get_manager(&state);
    let rows = manager
        .update_sample_license_metadata(
            &path,
            source,
            pack_name,
            license,
            license_url,
            license_memo,
        )
        .map_err(CommandError::from)?;
    if rows == 0 {
        return Err(CommandError {
            code: "not_found".to_string(),
            message: format!("no sample found at path '{}'; 0 rows updated", path),
            details: Some("The sample may have been deleted or the path is incorrect.".to_string()),
        });
    }
    Ok(rows)
}

struct AppState {
    manager: Arc<Mutex<SampleManager>>,
    prepared_temp_paths: PreparedTempRegistry,
    /// PID of the currently running timidity process, if any.
    timidity_pid: Arc<Mutex<Option<u32>>>,
    temp_midi_preview_file: Arc<Mutex<Option<tempfile::NamedTempFile>>>,
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
            open_sample_manager_core::ManagerError::ProcessedWav(_) => "processed_wav_error",
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

impl From<ProcessedWavError> for CommandError {
    fn from(value: ProcessedWavError) -> Self {
        let details = value.source().map(|e| e.to_string());
        Self {
            code: "processed_wav_error".to_string(),
            message: format!("processed WAV error: {value}"),
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

/// Helper: lock the shared SampleManager from AppState.
fn get_manager(state: &AppState) -> std::sync::MutexGuard<'_, SampleManager> {
    state.manager.lock().expect("AppState mutex poisoned")
}

fn stop_timidity_process(pid_state: &Arc<Mutex<Option<u32>>>) {
    let Ok(mut pid_lock) = pid_state.lock() else {
        return;
    };
    if let Some(pid) = pid_lock.take() {
        let _ = std::process::Command::new("kill")
            .arg("-TERM")
            .arg(pid.to_string())
            .output();
    }
}

#[tauri::command]
fn search_by_embedding(
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

    let emb_blob = sample.embedding.ok_or(CommandError {
        code: "no_embedding".to_string(),
        message: "sample has no embedding".to_string(),
        details: None,
    })?;
    if emb_blob.len() % 4 != 0 {
        return Err(CommandError {
            code: "invalid_embedding".to_string(),
            message: "embedding blob invalid".to_string(),
            details: None,
        });
    }
    let dim = emb_blob.len() / 4;
    let mut vec: Vec<f32> = Vec::with_capacity(dim);
    for i in 0..dim {
        let off = i * 4;
        let bytes: [u8; 4] = [
            emb_blob[off],
            emb_blob[off + 1],
            emb_blob[off + 2],
            emb_blob[off + 3],
        ];
        vec.push(f32::from_le_bytes(bytes));
    }

    let results = manager
        .search_by_embedding(&vec, k)
        .map_err(CommandError::from)?;
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
    app.clipboard().write_text(text).map_err(|e| e.to_string())
}

// start_native_file_drag removed.
// Renderer should call the plugin's public command directly (e.g. `invoke("plugin:drag|start_drag", ...)`)
// or use the JS wrapper exposed by the plugin (window.__TAURI__.drag.startDrag) instead of attempting
// to call into the plugin's internal symbols from Rust.

fn main() {
    // Create the builder and register plugins. We register the dragout plugin
    // only on macOS because it purposefully fails to compile on other
    // platforms (it uses macOS-only Objective-C APIs). Keeping the conditional
    // registration here avoids build errors on Linux/Windows while enabling
    // native file-promise drag semantics on macOS.
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_clipboard_manager::init());

    #[cfg(target_os = "macos")]
    {
        builder = builder
            .plugin(tauri_plugin_dragout::init())
            .plugin(tauri_plugin_drag::init());
    }

    builder = builder.setup(|app| {
        let db_path = match app.path().app_data_dir() {
            Ok(dir) => {
                let _ = std::fs::create_dir_all(&dir);
                Some(dir.join("samples.db"))
            }
            Err(_) => None,
        };

        let db_path_str = db_path.as_ref().map(|p| p.to_string_lossy().to_string());
        let manager = SampleManager::new(db_path_str.as_deref()).map_err(|error| {
            eprintln!("failed to open database at {:?}: {error}", db_path_str);
            std::io::Error::new(
                std::io::ErrorKind::Other,
                format!("failed to open database: {error}"),
            )
        })?;

        app.manage(AppState {
            manager: Arc::new(Mutex::new(manager)),
            prepared_temp_paths: Arc::new(Mutex::new(HashSet::new())),
            timidity_pid: Arc::new(Mutex::new(None)),
            temp_midi_preview_file: Arc::new(Mutex::new(None)),
        });
        Ok(())
    });

    builder = builder.invoke_handler(tauri::generate_handler![
        health_check,
        scan_directory,
        export_library_database,
        import_library_database,
        import_file,
        search_samples,
        // Paginated listing/search exposed to renderer. list_samples_paginated
        // currently ignores the `query` parameter and returns a LIMIT/OFFSET
        // paginated listing. Future change will wire server-side FTS filtering.
        list_samples_paginated,
        list_samples_around_id,
        search_by_embedding,
        get_sample,
        list_all_sample_paths,
        list_duplicate_groups,
        delete_sample,
        clear_all_samples,
        re_scan_all_samples,
        move_sample,
        send_to_trash,
        update_sample_classification,
        create_collection,
        list_collections,
        update_collection,
        delete_collection,
        add_samples_to_collection,
        remove_samples_from_collection,
        list_collection_samples,
        create_saved_search,
        list_saved_searches,
        update_saved_search,
        delete_saved_search,
        update_sample_license_metadata,
        get_instrument_types,
        add_instrument_type,
        delete_instrument_type,
        update_instrument_type,
        open_folder,
        copy_to_clipboard,
        prepare_drag_file,
        prepare_processed_drag_file,
        delete_file,
        get_drag_icon_path,
        debug_start_drag,
        debug_try_deserialize,
        // MIDI commands
        check_timidity,
        play_midi,
        stop_midi,
        scan_midi_directory,
        list_midis_paginated,
        list_midis_around_id,
        get_all_midi_paths,
        get_midi,
        delete_midi,
        clear_all_midis,
        search_midis,
        search_midis_paginated,
        // MIDI tag commands
        get_midi_tags,
        add_midi_tag,
        delete_midi_tag,
        update_midi_tag,
        set_midi_file_tag,
        get_midi_file_tags,
    ]);
    if let Err(error) = builder.run(tauri::generate_context!()) {
        eprintln!("error while running tauri application: {error}");
        std::process::exit(1);
    }
}

#[tauri::command]
fn get_instrument_types(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<open_sample_manager_core::db::operations::InstrumentTypeRow>, CommandError> {
    let manager = get_manager(&state);
    manager
        .get_all_instrument_types()
        .map_err(CommandError::from)
}

#[tauri::command]
fn add_instrument_type(
    name: String,
    state: tauri::State<'_, AppState>,
) -> Result<i64, CommandError> {
    let manager = get_manager(&state);
    manager
        .add_instrument_type(&name)
        .map_err(CommandError::from)
}

#[tauri::command]
fn delete_instrument_type(
    id: i64,
    state: tauri::State<'_, AppState>,
) -> Result<usize, CommandError> {
    let manager = get_manager(&state);
    manager
        .delete_instrument_type(id)
        .map_err(CommandError::from)
}

#[tauri::command]
fn update_instrument_type(
    id: i64,
    name: String,
    state: tauri::State<'_, AppState>,
) -> Result<usize, CommandError> {
    let manager = get_manager(&state);
    manager
        .update_instrument_type(id, &name)
        .map_err(CommandError::from)
}

// === MIDI Tag Commands ===

#[tauri::command]
fn get_midi_tags(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<open_sample_manager_core::db::operations::MidiTagRow>, CommandError> {
    let manager = get_manager(&state);
    manager.get_all_midi_tags().map_err(CommandError::from)
}

#[tauri::command]
fn add_midi_tag(name: String, state: tauri::State<'_, AppState>) -> Result<i64, CommandError> {
    let manager = get_manager(&state);
    manager.add_midi_tag(&name).map_err(CommandError::from)
}

#[tauri::command]
fn delete_midi_tag(id: i64, state: tauri::State<'_, AppState>) -> Result<usize, CommandError> {
    let manager = get_manager(&state);
    manager.delete_midi_tag(id).map_err(CommandError::from)
}

#[tauri::command]
fn update_midi_tag(
    id: i64,
    name: String,
    state: tauri::State<'_, AppState>,
) -> Result<usize, CommandError> {
    let manager = get_manager(&state);
    manager
        .update_midi_tag(id, &name)
        .map_err(CommandError::from)
}

#[tauri::command]
fn set_midi_file_tag(
    midi_id: i64,
    tag_id: Option<i64>,
    state: tauri::State<'_, AppState>,
) -> Result<(), CommandError> {
    let manager = get_manager(&state);
    manager
        .set_midi_file_tag(midi_id, tag_id)
        .map_err(CommandError::from)
}

#[tauri::command]
fn get_midi_file_tags(
    midi_id: i64,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<open_sample_manager_core::db::operations::MidiTagRow>, CommandError> {
    let manager = get_manager(&state);
    manager
        .get_midi_file_tags(midi_id)
        .map_err(CommandError::from)
}

// === MIDI Commands ===

/// Response for TiMidity availability check.
#[derive(Debug, Clone, Serialize)]
pub struct TimidityStatus {
    pub installed: bool,
    pub install_command: String,
}

fn timidity_install_command(os: &str) -> &'static str {
    match os {
        "macos" => "brew install timidity",
        "linux" => {
            "sudo apt-get install -y timidity (Debian/Ubuntu) or sudo dnf install timidity (Fedora)"
        }
        "windows" => "choco install timidity (or enable WSL and run a Linux installer)",
        _ => "Install TiMidity++ via your distribution's package manager",
    }
}
/// Locate timidity executable, searching common installation paths across platforms.
fn find_timidity_executable() -> Result<std::path::PathBuf, CommandError> {
    // First try PATH lookup
    if let Ok(path) = which::which("timidity") {
        return Ok(path);
    }

    // Build list of common installation paths by platform
    let common_paths: Vec<std::path::PathBuf> = if cfg!(target_os = "macos") {
        vec![
            // Homebrew on Apple Silicon
            std::path::PathBuf::from("/opt/homebrew/bin/timidity"),
            // Homebrew on Intel
            std::path::PathBuf::from("/usr/local/bin/timidity"),
            // MacPorts
            std::path::PathBuf::from("/opt/local/bin/timidity"),
        ]
    } else if cfg!(target_os = "linux") {
        vec![
            std::path::PathBuf::from("/usr/bin/timidity"),
            std::path::PathBuf::from("/usr/local/bin/timidity"),
            std::path::PathBuf::from("/snap/bin/timidity"),
            std::path::PathBuf::from("/opt/timidity/bin/timidity"),
        ]
    } else if cfg!(target_os = "windows") {
        vec![
            std::path::PathBuf::from("C:\\Program Files\\timidity\\timidity.exe"),
            std::path::PathBuf::from("C:\\Program Files (x86)\\timidity\\timidity.exe"),
            std::path::PathBuf::from("C:\\msys64\\mingw64\\bin\\timidity.exe"),
            std::path::PathBuf::from("C:\\chocolatey\\bin\\timidity.exe"),
        ]
    } else {
        vec![]
    };

    // Check each common path
    for base_path in common_paths {
        if base_path.exists() {
            return Ok(base_path);
        }
        // Also try expanding $HOME for linuxbrew
        if cfg!(target_os = "linux") {
            let path_str = base_path.to_string_lossy();
            if path_str.contains("$HOME") {
                if let Ok(home) = std::env::var("HOME") {
                    let expanded = path_str.replace("$HOME", &home);
                    let expanded_path = std::path::PathBuf::from(expanded);
                    if expanded_path.exists() {
                        return Ok(expanded_path);
                    }
                }
            }
        }
    }

    // Try using Command::new("timidity") directly as last resort
    if std::process::Command::new("timidity")
        .arg("--version")
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .is_ok()
    {
        return Ok(std::path::PathBuf::from("timidity"));
    }

    Err(CommandError {
        code: "timidity_not_found".to_string(),
        message: "TiMidity++ is not installed or not in PATH".to_string(),
        details: Some(format!(
            "Searched common paths. Install with: {}",
            timidity_install_command(std::env::consts::OS)
        )),
    })
}

/// Check if TiMidity is installed and return OS-specific install guidance.
#[tauri::command]
fn check_timidity() -> TimidityStatus {
    // Try to find TiMidity using comprehensive path search
    let timidity_result = find_timidity_executable();

    let installed = timidity_result.is_ok();

    // Get OS-specific install command
    let install_command = timidity_install_command(std::env::consts::OS).to_string();

    TimidityStatus {
        installed,
        install_command,
    }
}

fn cleanup_temp_midi_preview(temp_file: &Arc<Mutex<Option<tempfile::NamedTempFile>>>) {
    let _ = temp_file.lock().unwrap().take();
}

fn target_bpm_to_tempo_us(target_bpm: f64) -> Option<u32> {
    if !target_bpm.is_finite() || target_bpm <= 0.0 {
        return None;
    }
    Some((60_000_000.0 / target_bpm).round().clamp(1.0, 16_777_215.0) as u32)
}

fn transpose_note_key(key: midly::num::u7, semitones: i8) -> midly::num::u7 {
    let shifted = i16::from(key.as_int()) + i16::from(semitones);
    midly::num::u7::from(shifted.clamp(0, 127) as u8)
}

fn transform_midi_preview_bytes(
    bytes: &[u8],
    target_bpm: Option<f64>,
    transpose_semitones: Option<i8>,
) -> Result<Vec<u8>, CommandError> {
    let mut smf = midly::Smf::parse(bytes).map_err(|e| CommandError {
        code: "midi_parse_error".to_string(),
        message: format!("Failed to parse MIDI for preview sync: {}", e),
        details: None,
    })?;

    let target_tempo = target_bpm.and_then(target_bpm_to_tempo_us);
    for track in &mut smf.tracks {
        for event in track {
            match &mut event.kind {
                midly::TrackEventKind::Meta(midly::MetaMessage::Tempo(tempo)) => {
                    if let Some(target_tempo) = target_tempo {
                        *tempo = target_tempo.into();
                    }
                }
                midly::TrackEventKind::Midi { channel, message } => {
                    if channel.as_int() == 9 {
                        continue;
                    }
                    if let Some(semitones) = transpose_semitones {
                        match message {
                            midly::MidiMessage::NoteOn { key, .. }
                            | midly::MidiMessage::NoteOff { key, .. } => {
                                *key = transpose_note_key(*key, semitones);
                            }
                            _ => {}
                        }
                    }
                }
                _ => {}
            }
        }
    }

    let mut transformed = Vec::new();
    smf.write_std(&mut transformed).map_err(|e| CommandError {
        code: "midi_write_error".to_string(),
        message: format!("Failed to write preview MIDI: {}", e),
        details: None,
    })?;
    Ok(transformed)
}

fn create_preview_midi_file(
    path: &str,
    target_bpm: Option<f64>,
    transpose_semitones: Option<i8>,
) -> Result<tempfile::NamedTempFile, CommandError> {
    let metadata = std::fs::metadata(path).map_err(|e| CommandError {
        code: "midi_metadata_error".to_string(),
        message: format!("Failed to inspect MIDI file: {}", e),
        details: Some(path.to_string()),
    })?;
    if metadata.len() > MAX_MIDI_PREVIEW_BYTES {
        return Err(CommandError {
            code: "midi_preview_too_large".to_string(),
            message: "MIDI file is too large for synced preview".to_string(),
            details: Some(format!("{} bytes", metadata.len())),
        });
    }

    let bytes = std::fs::read(path).map_err(|e| CommandError {
        code: "midi_read_error".to_string(),
        message: format!("Failed to read MIDI file: {}", e),
        details: Some(path.to_string()),
    })?;
    let transformed = transform_midi_preview_bytes(&bytes, target_bpm, transpose_semitones)?;
    let mut temp_file = tempfile::Builder::new()
        .prefix("osm-preview-")
        .suffix(".mid")
        .tempfile()
        .map_err(|e| CommandError {
            code: "midi_temp_create_error".to_string(),
            message: format!("Failed to create temporary preview MIDI: {}", e),
            details: None,
        })?;
    temp_file
        .write_all(&transformed)
        .map_err(|e| CommandError {
            code: "midi_temp_write_error".to_string(),
            message: format!("Failed to write temporary preview MIDI: {}", e),
            details: Some(temp_file.path().to_string_lossy().to_string()),
        })?;
    Ok(temp_file)
}

/// Play a MIDI file using TiMidity++. Kills any previously running timidity process first.
#[tauri::command]
async fn play_midi(
    path: String,
    target_bpm: Option<f64>,
    transpose_semitones: Option<i8>,
    state: tauri::State<'_, AppState>,
) -> Result<(), CommandError> {
    // Kill any previously running timidity process
    stop_timidity_process(&state.timidity_pid);
    cleanup_temp_midi_preview(&state.temp_midi_preview_file);

    // Locate timidity executable using comprehensive path search
    let timidity = find_timidity_executable()?;

    // Select the audio output flag based on OS:
    //   macOS  → -Od  (CoreAudio PCM device)
    //   other  → -OO  (Libao, works on Linux/Windows with libao installed)
    let output_flag = if cfg!(target_os = "macos") {
        "-Od"
    } else {
        "-OO"
    };

    let playback_path = if target_bpm.is_some() || transpose_semitones.is_some() {
        let temp_file = create_preview_midi_file(&path, target_bpm, transpose_semitones)?;
        let temp_path = temp_file.path().to_path_buf();
        *state.temp_midi_preview_file.lock().unwrap() = Some(temp_file);
        temp_path
    } else {
        PathBuf::from(&path)
    };

    // Spawn timidity as a background process (non-blocking)
    let child = std::process::Command::new(timidity)
        .arg(output_flag)
        .arg(&playback_path)
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn()
        .map_err(|e| CommandError {
            code: "timidity_spawn_error".to_string(),
            message: format!("Failed to start TiMidity++: {}", e),
            details: None,
        })?;

    let pid = child.id();
    *state.timidity_pid.lock().unwrap() = Some(pid);
    Ok(())
}

/// Stop the currently playing MIDI file (kills timidity process).
#[tauri::command]
fn stop_midi(state: tauri::State<'_, AppState>) -> Result<(), CommandError> {
    stop_timidity_process(&state.timidity_pid);
    cleanup_temp_midi_preview(&state.temp_midi_preview_file);
    Ok(())
}

#[cfg(test)]
mod timidity_tests {
    use super::{
        create_preview_midi_file, target_bpm_to_tempo_us, timidity_install_command,
        transform_midi_preview_bytes, transpose_note_key, MAX_MIDI_PREVIEW_BYTES,
    };

    #[test]
    fn macos_command_matches_brew() {
        assert_eq!(timidity_install_command("macos"), "brew install timidity");
    }

    #[test]
    fn linux_command_mentions_apt_and_dnf() {
        assert!(timidity_install_command("linux").contains("apt-get"));
        assert!(timidity_install_command("linux").contains("dnf"));
    }

    #[test]
    fn windows_command_references_choco() {
        assert!(timidity_install_command("windows").contains("choco"));
    }

    #[test]
    fn fallback_command_suggests_package_manager() {
        assert_eq!(
            timidity_install_command("solaris"),
            "Install TiMidity++ via your distribution's package manager"
        );
    }

    #[test]
    fn target_bpm_maps_to_midi_tempo_microseconds() {
        assert_eq!(target_bpm_to_tempo_us(120.0), Some(500_000));
        assert_eq!(target_bpm_to_tempo_us(150.0), Some(400_000));
        assert_eq!(target_bpm_to_tempo_us(0.0), None);
    }

    #[test]
    fn transpose_note_clamps_to_midi_note_range() {
        assert_eq!(transpose_note_key(60.into(), 2).as_int(), 62);
        assert_eq!(transpose_note_key(1.into(), -4).as_int(), 0);
        assert_eq!(transpose_note_key(126.into(), 4).as_int(), 127);
    }

    #[test]
    fn transform_midi_rewrites_tempo_and_transposes_non_percussion_notes() {
        let smf = midly::Smf {
            header: midly::Header::new(
                midly::Format::SingleTrack,
                midly::Timing::Metrical(480.into()),
            ),
            tracks: vec![vec![
                midly::TrackEvent {
                    delta: 0.into(),
                    kind: midly::TrackEventKind::Meta(midly::MetaMessage::Tempo(500_000.into())),
                },
                midly::TrackEvent {
                    delta: 0.into(),
                    kind: midly::TrackEventKind::Midi {
                        channel: 0.into(),
                        message: midly::MidiMessage::NoteOn {
                            key: 60.into(),
                            vel: 100.into(),
                        },
                    },
                },
                midly::TrackEvent {
                    delta: 0.into(),
                    kind: midly::TrackEventKind::Midi {
                        channel: 9.into(),
                        message: midly::MidiMessage::NoteOn {
                            key: 36.into(),
                            vel: 100.into(),
                        },
                    },
                },
                midly::TrackEvent {
                    delta: 0.into(),
                    kind: midly::TrackEventKind::Meta(midly::MetaMessage::EndOfTrack),
                },
            ]],
        };
        let mut bytes = Vec::new();
        smf.write_std(&mut bytes).unwrap();

        let transformed = transform_midi_preview_bytes(&bytes, Some(150.0), Some(2)).unwrap();
        let parsed = midly::Smf::parse(&transformed).unwrap();

        match parsed.tracks[0][0].kind {
            midly::TrackEventKind::Meta(midly::MetaMessage::Tempo(tempo)) => {
                assert_eq!(tempo.as_int(), 400_000)
            }
            _ => panic!("expected tempo event"),
        }
        match parsed.tracks[0][1].kind {
            midly::TrackEventKind::Midi {
                message: midly::MidiMessage::NoteOn { key, .. },
                ..
            } => assert_eq!(key.as_int(), 62),
            _ => panic!("expected note event"),
        }
        match parsed.tracks[0][2].kind {
            midly::TrackEventKind::Midi {
                message: midly::MidiMessage::NoteOn { key, .. },
                ..
            } => assert_eq!(key.as_int(), 36),
            _ => panic!("expected percussion event"),
        }
    }

    #[test]
    fn preview_file_rejects_oversized_midi_before_reading() {
        let input = tempfile::NamedTempFile::new().unwrap();
        input.as_file().set_len(MAX_MIDI_PREVIEW_BYTES + 1).unwrap();

        let err = create_preview_midi_file(input.path().to_str().unwrap(), Some(120.0), None)
            .expect_err("oversized MIDI should be rejected");

        assert_eq!(err.code, "midi_preview_too_large");
    }
}

/// Scan a directory for MIDI files.
#[tauri::command]
async fn scan_midi_directory(
    path: String,
    state: tauri::State<'_, AppState>,
) -> Result<usize, CommandError> {
    let mgr = Arc::clone(&state.manager);

    let result = tokio::task::spawn_blocking(move || {
        let manager = mgr.lock().expect("AppState mutex poisoned");
        manager
            .scan_midi_directory(path)
            .map_err(CommandError::from)
    })
    .await
    .map_err(|e| CommandError {
        code: "task_error".to_string(),
        message: e.to_string(),
        details: None,
    })?;

    result
}

/// List MIDI files with pagination.
#[tauri::command]
fn list_midis_paginated(
    limit: usize,
    offset: usize,
    directory_path: Option<String>,
    tag_id: Option<i64>,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<open_sample_manager_core::db::operations::MidiRow>, CommandError> {
    let manager = get_manager(&state);
    manager
        .list_midis_paginated(limit, offset, directory_path.as_deref(), tag_id)
        .map_err(CommandError::from)
}

/// List MIDI files around a specific ID.
#[tauri::command]
fn list_midis_around_id(
    target_id: i64,
    limit: usize,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<open_sample_manager_core::db::operations::MidiRow>, CommandError> {
    let manager = get_manager(&state);
    manager
        .list_midis_around_id(target_id, limit)
        .map_err(CommandError::from)
}

/// Get all MIDI file paths.
#[tauri::command]
fn get_all_midi_paths(state: tauri::State<'_, AppState>) -> Result<Vec<String>, CommandError> {
    let manager = get_manager(&state);
    manager.get_all_midi_paths().map_err(CommandError::from)
}

/// Get a MIDI file by path.
#[tauri::command]
fn get_midi(
    path: String,
    state: tauri::State<'_, AppState>,
) -> Result<Option<open_sample_manager_core::db::operations::MidiRow>, CommandError> {
    let manager = get_manager(&state);
    manager.get_midi(&path).map_err(CommandError::from)
}

/// Delete a MIDI file by path.
#[tauri::command]
fn delete_midi(path: String, state: tauri::State<'_, AppState>) -> Result<usize, CommandError> {
    let manager = get_manager(&state);
    manager.delete_midi(&path).map_err(CommandError::from)
}

/// Clear all MIDI files from the database.
#[tauri::command]
fn clear_all_midis(state: tauri::State<'_, AppState>) -> Result<usize, CommandError> {
    let manager = get_manager(&state);
    manager.clear_all_midis().map_err(CommandError::from)
}

/// Search MIDI files by name.
#[tauri::command]
fn search_midis(
    query: String,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<open_sample_manager_core::db::operations::MidiRow>, CommandError> {
    let manager = get_manager(&state);
    manager.search_midis(&query).map_err(CommandError::from)
}

#[tauri::command]
fn search_midis_paginated(
    query: String,
    limit: usize,
    offset: usize,
    directory_path: Option<String>,
    tag_id: Option<i64>,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<open_sample_manager_core::db::operations::MidiRow>, CommandError> {
    let manager = get_manager(&state);
    manager
        .search_midis_paginated(&query, limit, offset, directory_path.as_deref(), tag_id)
        .map_err(CommandError::from)
}
