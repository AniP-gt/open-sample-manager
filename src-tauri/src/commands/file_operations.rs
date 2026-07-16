use open_sample_manager_core::analysis::processed_wav::{
    render_processed_wav, ProcessedSampleRenderSeconds,
};
use std::path::{Path, PathBuf};
use std::sync::Arc;

use crate::app_state::{AppState, PreparedTempRegistry};

use super::CommandError;

#[tauri::command]
pub fn open_folder(path: String) -> Result<(), String> {
    open::that(&path).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn copy_to_clipboard(text: String, app: tauri::AppHandle) -> Result<(), String> {
    use tauri_plugin_clipboard_manager::ClipboardExt;

    app.clipboard()
        .write_text(text)
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn prepare_drag_file(
    path: String,
    state: tauri::State<'_, AppState>,
) -> Result<String, CommandError> {
    let prepared_temp_paths = Arc::clone(&state.prepared_temp_paths);
    tokio::task::spawn_blocking(move || {
        let source = Path::new(&path);
        if !source.exists() {
            return Err(CommandError {
                code: "not_found".to_string(),
                message: format!("source path does not exist: {path}"),
                details: None,
            });
        }
        let target = copy_to_prepared_temp_file(source)?;
        register_prepared_temp_path(&prepared_temp_paths, &target)?;
        Ok(target.to_string_lossy().to_string())
    })
    .await
    .map_err(task_error)?
}

#[tauri::command]
pub async fn prepare_processed_drag_file(
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
                message: format!("source path does not exist: {path}"),
                details: None,
            });
        }
        let output_path = processed_drag_output_path(&source)?;
        render_processed_wav(&source, &output_path, params).map_err(CommandError::from)?;
        register_prepared_temp_path(&prepared_temp_paths, &output_path)?;
        Ok(output_path.to_string_lossy().to_string())
    })
    .await
    .map_err(task_error)?
}

#[tauri::command]
pub fn delete_file(path: String, state: tauri::State<'_, AppState>) -> Result<(), CommandError> {
    delete_registered_temp_file(&path, &state.prepared_temp_paths)
}

fn delete_registered_temp_file(
    path: impl AsRef<Path>,
    prepared_temp_paths: &PreparedTempRegistry,
) -> Result<(), CommandError> {
    let target = PathBuf::from(path.as_ref());
    let canonical_target = target.canonicalize().map_err(|error| CommandError {
        code: "io_error".to_string(),
        message: format!("failed to resolve path for deletion: {error}"),
        details: None,
    })?;
    let registered = prepared_temp_paths
        .lock()
        .expect("prepared temp registry mutex poisoned")
        .contains(&canonical_target);
    if !registered {
        return Err(CommandError {
            code: "invalid_path".to_string(),
            message: "delete_file only removes app-created prepared drag files".to_string(),
            details: None,
        });
    }
    if canonical_target.is_file() {
        std::fs::remove_file(&canonical_target).map_err(|error| CommandError {
            code: "io_error".to_string(),
            message: format!("failed to delete temp file: {error}"),
            details: None,
        })?;
    }
    prepared_temp_paths
        .lock()
        .expect("prepared temp registry mutex poisoned")
        .remove(&canonical_target);
    Ok(())
}

fn register_prepared_temp_path(
    prepared_temp_paths: &PreparedTempRegistry,
    path: &Path,
) -> Result<(), CommandError> {
    let canonical_path = path.canonicalize().map_err(|error| CommandError {
        code: "io_error".to_string(),
        message: format!("failed to register prepared drag file: {error}"),
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
    let mut source_file = std::fs::File::open(source).map_err(|error| CommandError {
        code: "io_error".to_string(),
        message: format!("failed to open drag source file: {error}"),
        details: None,
    })?;
    let mut target_file = std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&target)
        .map_err(|error| CommandError {
            code: "io_error".to_string(),
            message: format!("failed to create prepared drag file: {error}"),
            details: None,
        })?;
    if let Err(error) = std::io::copy(&mut source_file, &mut target_file) {
        let _ = std::fs::remove_file(&target);
        return Err(CommandError {
            code: "io_error".to_string(),
            message: format!("failed to prepare drag file: {error}"),
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
    std::fs::create_dir_all(&output_dir).map_err(|error| CommandError {
        code: "io_error".to_string(),
        message: format!("failed to create drag temp directory: {error}"),
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

#[tauri::command]
pub fn get_drag_icon_path() -> Result<String, CommandError> {
    #[rustfmt::skip]
    const TRANSPARENT_PNG_1X1: &[u8] = &[
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
        0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41,
        0x54, 0x78, 0x9C, 0x62, 0x00, 0x00, 0x00, 0x02,
        0x00, 0x01, 0xE2, 0x21, 0xBC, 0x33, 0x00, 0x00,
        0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42,
        0x60, 0x82,
    ];
    let mut path = std::env::temp_dir();
    path.push("osm_drag_icon.png");
    if !path.exists() {
        std::fs::write(&path, TRANSPARENT_PNG_1X1).map_err(|error| CommandError {
            code: "io_error".to_string(),
            message: format!("failed to write drag icon: {error}"),
            details: None,
        })?;
    }
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn debug_start_drag(raw: serde_json::Value) -> Result<(), CommandError> {
    eprintln!("[debug_start_drag] raw payload: {raw}");
    Ok(())
}

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
pub fn debug_try_deserialize(raw: serde_json::Value) -> Result<String, CommandError> {
    let mut successes = Vec::new();
    let mut failures = Vec::new();
    match serde_json::from_value::<CandidateItemArray>(raw.clone()) {
        Ok(value) => successes.push(format!("CandidateItemArray -> {value:?}")),
        Err(error) => failures.push(format!("CandidateItemArray: {error}")),
    }
    match serde_json::from_value::<CandidateFiles>(raw.clone()) {
        Ok(value) => successes.push(format!("CandidateFiles -> {value:?}")),
        Err(error) => failures.push(format!("CandidateFiles: {error}")),
    }
    match serde_json::from_value::<CandidateFilesCapital>(raw.clone()) {
        Ok(value) => successes.push(format!("CandidateFilesCapital -> {value:?}")),
        Err(error) => failures.push(format!("CandidateFilesCapital: {error}")),
    }
    match serde_json::from_value::<CandidateImageFile>(raw.clone()) {
        Ok(value) => successes.push(format!("CandidateImageFile -> {value:?}")),
        Err(error) => failures.push(format!("CandidateImageFile: {error}")),
    }
    match serde_json::from_value::<CandidateImagePath>(raw.clone()) {
        Ok(value) => successes.push(format!("CandidateImagePath -> {value:?}")),
        Err(error) => failures.push(format!("CandidateImagePath: {error}")),
    }
    eprintln!("[debug_try_deserialize] successes: {successes:?}");
    eprintln!("[debug_try_deserialize] failures: {failures:?}");
    Ok(format!(
        "successes: {}, failures: {}",
        successes.len(),
        failures.len()
    ))
}

fn task_error(error: tokio::task::JoinError) -> CommandError {
    CommandError {
        code: "task_error".to_string(),
        message: error.to_string(),
        details: None,
    }
}

#[cfg(test)]
mod tests {
    use super::delete_registered_temp_file;
    use crate::app_state::PreparedTempRegistry;
    use std::collections::HashSet;
    use std::sync::{Arc, Mutex};

    #[test]
    fn delete_registered_temp_file_rejects_unregistered_file() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("unregistered.wav");
        std::fs::write(&path, b"not app-created").unwrap();
        let registry: PreparedTempRegistry = Arc::new(Mutex::new(HashSet::new()));
        let error = delete_registered_temp_file(&path, &registry).unwrap_err();
        assert_eq!(error.code, "invalid_path");
        assert!(path.exists());
    }

    #[test]
    fn delete_registered_temp_file_removes_registered_file() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("registered.wav");
        std::fs::write(&path, b"app-created").unwrap();
        let canonical_path = path.canonicalize().unwrap();
        let registry: PreparedTempRegistry = Arc::new(Mutex::new(HashSet::new()));
        registry.lock().unwrap().insert(canonical_path);
        delete_registered_temp_file(&path, &registry).unwrap();
        assert!(!path.exists());
        assert!(registry.lock().unwrap().is_empty());
    }
}
