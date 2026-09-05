use std::{fs::File, io::Read, path::Path};

use tauri::{ipc::Response, WebviewWindow};

use super::CommandError;

/// Raw audio preview is fully buffered for Tauri IPC and browser object URLs.
pub(crate) const MAX_AUDIO_PREVIEW_BYTES: u64 = 512 * 1024 * 1024;

fn storage_error() -> CommandError {
    CommandError {
        code: "audio_file_unavailable".to_string(),
        message: "audio file is unavailable".to_string(),
        details: None,
    }
}

fn preview_file_too_large_error(file_size: u64, byte_limit: u64) -> CommandError {
    CommandError {
        code: "audio_preview_too_large".to_string(),
        message: "audio file is too large for preview".to_string(),
        details: Some(format!(
            "{file_size} bytes exceeds the {byte_limit}-byte preview limit"
        )),
    }
}

fn validate_preview_file_size(file_size: u64) -> Result<(), CommandError> {
    if file_size > MAX_AUDIO_PREVIEW_BYTES {
        return Err(preview_file_too_large_error(
            file_size,
            MAX_AUDIO_PREVIEW_BYTES,
        ));
    }

    Ok(())
}

fn read_preview_bytes(
    reader: impl Read,
    capacity: usize,
    byte_limit: u64,
) -> Result<Vec<u8>, CommandError> {
    let mut bytes = Vec::new();
    bytes
        .try_reserve_exact(capacity)
        .map_err(|_| storage_error())?;
    reader
        .take(byte_limit.saturating_add(1))
        .read_to_end(&mut bytes)
        .map_err(|_| storage_error())?;
    let file_size = u64::try_from(bytes.len()).map_err(|_| storage_error())?;
    if file_size > byte_limit {
        return Err(preview_file_too_large_error(file_size, byte_limit));
    }
    Ok(bytes)
}

#[tauri::command]
pub async fn read_audio_file(
    path: String,
    window: WebviewWindow,
) -> Result<Response, CommandError> {
    if window.label() != "main" {
        return Err(CommandError {
            code: "audio_access_denied".to_string(),
            message: "audio playback is only available to the main window".to_string(),
            details: None,
        });
    }
    let bytes = tokio::task::spawn_blocking(move || read_regular_file_bytes(Path::new(&path)))
        .await
        .map_err(|_| storage_error())??;
    Ok(Response::new(bytes))
}

fn read_regular_file_bytes(path: &Path) -> Result<Vec<u8>, CommandError> {
    let file = File::open(path).map_err(|_| storage_error())?;
    let metadata = file.metadata().map_err(|_| storage_error())?;
    if !metadata.is_file() {
        return Err(CommandError {
            code: "audio_file_rejected".to_string(),
            message: "audio file is unavailable".to_string(),
            details: None,
        });
    }
    validate_preview_file_size(metadata.len())?;
    let capacity = usize::try_from(metadata.len()).map_err(|_| storage_error())?;
    read_preview_bytes(file, capacity, MAX_AUDIO_PREVIEW_BYTES)
}

#[cfg(test)]
mod tests {
    use std::io::Cursor;

    use super::{
        read_preview_bytes, read_regular_file_bytes, validate_preview_file_size,
        MAX_AUDIO_PREVIEW_BYTES,
    };

    #[test]
    fn reads_regular_file_bytes() {
        let file = tempfile::NamedTempFile::new().expect("file");
        std::fs::write(file.path(), b"audio").expect("write");
        assert_eq!(
            read_regular_file_bytes(file.path()).expect("read"),
            b"audio"
        );
    }

    #[test]
    fn reads_file_larger_than_former_preview_limit() {
        let file = tempfile::NamedTempFile::new().expect("file");
        file.as_file()
            .set_len((64 * 1024 * 1024) + 1)
            .expect("resize");
        assert_eq!(
            read_regular_file_bytes(file.path()).expect("read").len(),
            (64 * 1024 * 1024) + 1
        );
    }

    #[test]
    fn preview_reader_accepts_bytes_at_its_limit() {
        let bytes = read_preview_bytes(Cursor::new(b"audio"), 0, 5).expect("read");

        assert_eq!(bytes, b"audio");
    }

    #[test]
    fn preview_reader_rejects_bytes_above_its_limit() {
        let error = read_preview_bytes(Cursor::new(b"audio"), 0, 4).expect_err("too large");

        assert_eq!(error.code, "audio_preview_too_large");
    }

    #[test]
    fn accepts_file_at_audio_preview_ceiling() {
        assert!(validate_preview_file_size(MAX_AUDIO_PREVIEW_BYTES).is_ok());
    }

    #[test]
    fn rejects_file_above_audio_preview_ceiling() {
        let file = tempfile::NamedTempFile::new().expect("file");
        file.as_file()
            .set_len(MAX_AUDIO_PREVIEW_BYTES + 1)
            .expect("resize");
        let error = read_regular_file_bytes(file.path()).expect_err("too large");

        assert_eq!(error.code, "audio_preview_too_large");
    }
}
