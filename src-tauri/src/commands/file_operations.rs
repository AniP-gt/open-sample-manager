use open_sample_manager_core::analysis::processed_wav::{
    render_processed_wav, ProcessedSampleRenderSeconds,
};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use tauri::Manager;

use super::CommandError;

static PROCESSED_DRAG_SEQUENCE: AtomicU64 = AtomicU64::new(0);

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
pub async fn prepare_processed_drag_file(
    path: String,
    params: ProcessedSampleRenderSeconds,
    app: tauri::AppHandle,
) -> Result<String, CommandError> {
    let app_data_directory = app.path().app_data_dir().map_err(|error| CommandError {
        code: "app_data_dir_unavailable".to_string(),
        message: format!("failed to resolve application data directory: {error}"),
        details: None,
    })?;
    tokio::task::spawn_blocking(move || {
        let source = PathBuf::from(&path);
        if !source.exists() {
            return Err(CommandError {
                code: "not_found".to_string(),
                message: format!("source path does not exist: {path}"),
                details: None,
            });
        }
        let output_path = processed_drag_output_path(&app_data_directory, &source);
        render_processed_wav(&source, &output_path, params).map_err(CommandError::from)?;
        Ok(output_path.to_string_lossy().to_string())
    })
    .await
    .map_err(task_error)?
}

fn processed_drag_output_path(app_data_directory: &Path, source: &Path) -> PathBuf {
    let output_directory = app_data_directory.join("processed-drag");
    let stem = source
        .file_stem()
        .and_then(|value| value.to_str())
        .filter(|value| !value.is_empty())
        .unwrap_or("sample");
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or(0);
    let sequence = PROCESSED_DRAG_SEQUENCE.fetch_add(1, Ordering::Relaxed);

    output_directory.join(format!(
        "{stem}-{}-{timestamp}-{sequence}.wav",
        std::process::id()
    ))
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
    use super::{processed_drag_output_path, render_processed_wav, ProcessedSampleRenderSeconds};
    use std::path::Path;

    #[test]
    fn processed_drag_output_path_uses_app_data_directory_when_rendering() {
        let app_data_directory = tempfile::tempdir().unwrap();
        let source = Path::new("/samples/kick.flac");

        let output = processed_drag_output_path(app_data_directory.path(), source);

        assert_eq!(
            output.parent(),
            Some(app_data_directory.path().join("processed-drag").as_path())
        );
        assert_eq!(
            output.extension().and_then(|extension| extension.to_str()),
            Some("wav")
        );
    }

    #[test]
    fn processed_drag_output_path_generates_unique_wav_names() {
        let app_data_directory = tempfile::tempdir().unwrap();
        let source = Path::new("/samples/kick.flac");

        let first = processed_drag_output_path(app_data_directory.path(), source);
        let second = processed_drag_output_path(app_data_directory.path(), source);

        assert_ne!(first, second);
    }

    #[test]
    fn processed_drag_render_writes_wav_under_app_data_directory() {
        let app_data_directory = tempfile::tempdir().unwrap();
        let source =
            Path::new(env!("CARGO_MANIFEST_DIR")).join("../core/tests/fixtures/sine_440hz_1s.wav");
        let output = processed_drag_output_path(app_data_directory.path(), &source);

        render_processed_wav(&source, &output, ProcessedSampleRenderSeconds::default()).unwrap();

        assert!(output.is_file());
        assert_eq!(
            output.parent(),
            Some(app_data_directory.path().join("processed-drag").as_path())
        );
    }
}
