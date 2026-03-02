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
fn list_samples_paginated(
    query: Option<String>,
    limit: usize,
    offset: usize,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<open_sample_manager_core::db::operations::SampleRow>, CommandError> {
    let manager = open_manager(state.db_path.as_deref())?;
    match query {
        Some(q) => manager
            .search_paginated(&q, limit, offset)
            .map_err(CommandError::from),
        None => manager.list_samples_paginated(limit, offset).map_err(CommandError::from),
    }
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
fn list_all_sample_paths(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<String>, CommandError> {
    let manager = open_manager(state.db_path.as_deref())?;
    manager.get_all_sample_paths().map_err(CommandError::from)
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

/// Prepare a filesystem-backed copy of a sample for dragging to external apps.
/// Some samples may be stored in locations not directly accessible to other
/// applications (e.g. packaged resources or virtual blobs). This command
/// copies the file to the system temporary directory and returns the absolute
/// path which can be used as a `file://` URI on the renderer side.
#[tauri::command]
fn prepare_drag_file(path: String) -> Result<String, CommandError> {
    let src = std::path::Path::new(&path);
    if !src.exists() {
        return Err(CommandError {
            code: "not_found".to_string(),
            message: format!("source path does not exist: {}", path),
            details: None,
        });
    }

    let file_name = match src.file_name().and_then(|s| s.to_str()) {
        Some(n) => n.to_string(),
        None => {
            let ts = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_secs())
                .unwrap_or(0);
            format!("drag-{}", ts)
        }
    };

    // On macOS/desktop environments, placing the prepared file in the user's
    // Desktop folder increases the chance the receiving native app (Logic,
    // etc.) will accept the file directly instead of creating a .fileloc
    // reference. Fall back to temp_dir on any failure.
    let mut target = std::env::temp_dir();
    if cfg!(target_os = "macos") {
        if let Ok(home) = std::env::var("HOME") {
            let mut desktop = std::path::PathBuf::from(home);
            desktop.push("Desktop");
            if desktop.exists() && desktop.is_dir() {
                target = desktop;
            }
        }
    }
    // Use original filename (no prefix)
    target.push(file_name);

    // Debug log so renderer-side failures can be correlated with backend activity
    eprintln!("[prepare_drag_file] copying '{}' -> '{}'", src.display(), target.display());
    match std::fs::copy(&src, &target) {
        Ok(_) => {
            let out = target.to_string_lossy().to_string();
            eprintln!("[prepare_drag_file] prepared -> {}", out);
            Ok(out)
        }
        Err(e) => Err(CommandError {
            code: "io_error".to_string(),
            message: format!("failed to prepare drag file: {}", e),
            details: None,
        }),
    }
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
#[derive(serde::Deserialize, Debug)]
struct CandidateFiles { files: Vec<String> }

#[derive(serde::Deserialize, Debug)]
struct CandidateFilesCapital { Files: Vec<String> }

#[derive(serde::Deserialize, Debug)]
struct CandidateItemArray(Vec<String>);

#[derive(serde::Deserialize, Debug)]
struct CandidateImageFile { File: String }

#[derive(serde::Deserialize, Debug)]
struct CandidateImagePath { path: String }

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

    Ok(format!("successes: {}, failures: {}", successes.len(), failures.len()))
}

// (start_native_drag wrapper removed) Renderer should call `native_drag_out`
// directly via `invoke("native_drag_out", { archive_path, file_paths, target_dir })`.

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

        app.manage(AppState { db_path });
        Ok(())
    });

    builder = builder.invoke_handler(tauri::generate_handler![
        health_check,
        scan_directory,
        search_samples,
        // Paginated listing/search exposed to renderer. list_samples_paginated
        // currently ignores the `query` parameter and returns a LIMIT/OFFSET
        // paginated listing. Future change will wire server-side FTS filtering.
        list_samples_paginated,
        search_by_embedding,
        get_sample,
        list_all_sample_paths,
        delete_sample,
        clear_all_samples,
        move_sample,
        send_to_trash,
        update_sample_classification,
        get_instrument_types,
        add_instrument_type,
        delete_instrument_type,
        update_instrument_type,
        open_folder,
        copy_to_clipboard,
        prepare_drag_file,
        debug_start_drag,
        debug_try_deserialize,
    ]);

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn get_instrument_types(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<open_sample_manager_core::db::operations::InstrumentTypeRow>, CommandError> {
    let manager = open_manager(state.db_path.as_deref())?;
    manager.get_all_instrument_types().map_err(CommandError::from)
}

#[tauri::command]
fn add_instrument_type(
    name: String,
    state: tauri::State<'_, AppState>,
) -> Result<i64, CommandError> {
    let manager = open_manager(state.db_path.as_deref())?;
    manager.add_instrument_type(&name).map_err(CommandError::from)
}

#[tauri::command]
fn delete_instrument_type(
    id: i64,
    state: tauri::State<'_, AppState>,
) -> Result<usize, CommandError> {
    let manager = open_manager(state.db_path.as_deref())?;
    manager.delete_instrument_type(id).map_err(CommandError::from)
}

#[tauri::command]
fn update_instrument_type(
    id: i64,
    name: String,
    state: tauri::State<'_, AppState>,
) -> Result<usize, CommandError> {
    let manager = open_manager(state.db_path.as_deref())?;
    manager.update_instrument_type(id, &name).map_err(CommandError::from)
}


// === MIDI Commands ===

/// Response for TiMidity availability check.
#[derive(Debug, Clone, Serialize)]
pub struct TimidityStatus {
    pub installed: bool,
    pub install_command: String,
}

/// Check if TiMidity is installed and return OS-specific install guidance.
#[tauri::command]
fn check_timidity() -> TimidityStatus {
    // Try to find TiMidity in PATH
    let timidity_path = which::which("timidity");
    
    let installed = timidity_path.is_ok();
    
    // Get OS-specific install command
    #[cfg(target_os = "macos")]
    let install_command = "brew install timidity".to_string();
    
    #[cfg(target_os = "linux")]
    let install_command = "sudo apt-get install timidity (Debian/Ubuntu) or sudo dnf install timidity (Fedora)".to_string();
    
    #[cfg(target_os = "windows")]
    let install_command = "Use Cygwin or MSYS2 to install timidity: pacman -S timidity".to_string();
    
    #[cfg(not(any(target_os = "macos", target_os = "linux", target_os = "windows")))]
    let install_command = "Install TiMidity++ via your distribution's package manager".to_string();
    
    TimidityStatus {
        installed,
        install_command,
    }
}

/// Scan a directory for MIDI files.
#[tauri::command]
async fn scan_midi_directory(
    path: String,
    state: tauri::State<'_, AppState>,
) -> Result<usize, CommandError> {
    let db_path = state.db_path.clone();
    
    let result = tokio::task::spawn_blocking(move || {
        let manager = open_manager(db_path.as_deref())?;
        manager.scan_midi_directory(path).map_err(CommandError::from)
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
    state: tauri::State<'_, AppState>,
) -> Result<Vec<open_sample_manager_core::db::operations::MidiRow>, CommandError> {
    let manager = open_manager(state.db_path.as_deref())?;
    manager.list_midis_paginated(limit, offset).map_err(CommandError::from)
}

/// Get all MIDI file paths.
#[tauri::command]
fn get_all_midi_paths(
    state: tauri::State<'_, AppState>,
) -> Result<Vec<String>, CommandError> {
    let manager = open_manager(state.db_path.as_deref())?;
    manager.get_all_midi_paths().map_err(CommandError::from)
}

/// Get a MIDI file by path.
#[tauri::command]
fn get_midi(
    path: String,
    state: tauri::State<'_, AppState>,
) -> Result<Option<open_sample_manager_core::db::operations::MidiRow>, CommandError> {
    let manager = open_manager(state.db_path.as_deref())?;
    manager.get_midi(&path).map_err(CommandError::from)
}

/// Delete a MIDI file by path.
#[tauri::command]
fn delete_midi(
    path: String,
    state: tauri::State<'_, AppState>,
) -> Result<usize, CommandError> {
    let manager = open_manager(state.db_path.as_deref())?;
    manager.delete_midi(&path).map_err(CommandError::from)
}

/// Clear all MIDI files from the database.
#[tauri::command]
fn clear_all_midis(
    state: tauri::State<'_, AppState>,
) -> Result<usize, CommandError> {
    let manager = open_manager(state.db_path.as_deref())?;
    manager.clear_all_midis().map_err(CommandError::from)
}

/// Search MIDI files by name.
#[tauri::command]
fn search_midis(
    query: String,
    state: tauri::State<'_, AppState>,
) -> Result<Vec<open_sample_manager_core::db::operations::MidiRow>, CommandError> {
    let manager = open_manager(state.db_path.as_deref())?;
    manager.search_midis(&query).map_err(CommandError::from)
}
