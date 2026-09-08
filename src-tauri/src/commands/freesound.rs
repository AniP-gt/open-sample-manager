use tauri::{ipc::Response, AppHandle, Manager};

use crate::freesound::{
    credential_path, credential_status, delete_credential, fetch_preview, save_credential, search,
    write_preview_download, CredentialStatus, FreesoundApiError, FreesoundApiKey,
    FreesoundCredentialError, FreesoundSearchResponse, PreviewDownloadError,
};

use super::CommandError;

impl From<FreesoundCredentialError> for CommandError {
    fn from(value: FreesoundCredentialError) -> Self {
        let code = match value {
            FreesoundCredentialError::InvalidKey => "freesound_api_key_invalid",
            FreesoundCredentialError::Read(_) => "freesound_credential_read_failed",
            FreesoundCredentialError::Write => "freesound_credential_write_failed",
            FreesoundCredentialError::Parse => "freesound_credential_invalid",
        };
        Self {
            code: code.to_owned(),
            message: value.to_string(),
            details: None,
        }
    }
}

impl From<FreesoundApiError> for CommandError {
    fn from(value: FreesoundApiError) -> Self {
        let code = match value {
            FreesoundApiError::Credential(error) => return Self::from(error),
            FreesoundApiError::InvalidQuery => "freesound_query_invalid",
            FreesoundApiError::InvalidPage => "freesound_page_invalid",
            FreesoundApiError::InvalidPreviewUrl => "freesound_preview_url_invalid",
            FreesoundApiError::Unauthorized => "freesound_unauthorized",
            FreesoundApiError::RateLimited => "freesound_rate_limited",
            FreesoundApiError::Request => "freesound_request_failed",
            FreesoundApiError::Response => "freesound_response_invalid",
            FreesoundApiError::TooLarge => "freesound_preview_too_large",
        };
        Self {
            code: code.to_owned(),
            message: value.to_string(),
            details: None,
        }
    }
}

impl From<PreviewDownloadError> for CommandError {
    fn from(value: PreviewDownloadError) -> Self {
        let code = match value {
            PreviewDownloadError::InvalidDestination => "freesound_download_destination_invalid",
            PreviewDownloadError::DestinationExists => "freesound_download_destination_exists",
            PreviewDownloadError::Storage(_) => "freesound_download_storage_failed",
        };
        Self {
            code: code.to_owned(),
            message: value.to_string(),
            details: None,
        }
    }
}

fn config_path(app: &AppHandle) -> Result<std::path::PathBuf, CommandError> {
    app.path()
        .app_config_dir()
        .map(|path| credential_path(&path))
        .map_err(|_| CommandError {
            code: "freesound_config_unavailable".to_owned(),
            message: "Freesound configuration directory is unavailable".to_owned(),
            details: None,
        })
}

async fn run_storage<T: Send + 'static>(
    operation: impl FnOnce() -> Result<T, FreesoundCredentialError> + Send + 'static,
) -> Result<T, CommandError> {
    tokio::task::spawn_blocking(operation)
        .await
        .map_err(|_| CommandError {
            code: "freesound_storage_failed".to_owned(),
            message: "Freesound credential storage failed".to_owned(),
            details: None,
        })?
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn get_freesound_credential_status(
    app: AppHandle,
) -> Result<CredentialStatus, CommandError> {
    let path = config_path(&app)?;
    run_storage(move || credential_status(&path)).await
}

#[tauri::command]
pub async fn save_freesound_api_key(
    api_key: String,
    app: AppHandle,
) -> Result<CredentialStatus, CommandError> {
    let key = FreesoundApiKey::parse(&api_key).map_err(CommandError::from)?;
    let path = config_path(&app)?;
    run_storage(move || save_credential(&path, key)).await
}

#[tauri::command]
pub async fn delete_freesound_api_key(app: AppHandle) -> Result<CredentialStatus, CommandError> {
    let path = config_path(&app)?;
    run_storage(move || delete_credential(&path)).await
}

#[tauri::command]
pub async fn search_freesound(
    query: String,
    page: Option<u32>,
    app: AppHandle,
) -> Result<FreesoundSearchResponse, CommandError> {
    search(&config_path(&app)?, &query, page)
        .await
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn fetch_freesound_preview(preview_url: String) -> Result<Response, CommandError> {
    fetch_preview(&preview_url)
        .await
        .map(preview_response)
        .map_err(CommandError::from)
}

#[tauri::command]
pub async fn download_freesound_preview(
    preview_url: String,
    result_name: String,
    destination_directory: String,
) -> Result<String, CommandError> {
    let bytes = fetch_preview(&preview_url)
        .await
        .map_err(CommandError::from)?;
    let path = tokio::task::spawn_blocking(move || {
        write_preview_download(
            std::path::Path::new(&destination_directory),
            &result_name,
            &bytes,
        )
    })
    .await
    .map_err(|_| CommandError {
        code: "freesound_download_storage_failed".to_owned(),
        message: "Freesound preview storage failed".to_owned(),
        details: None,
    })??;
    path.into_os_string()
        .into_string()
        .map_err(|_| CommandError {
            code: "freesound_download_path_invalid".to_owned(),
            message: "Freesound preview destination path is not UTF-8".to_owned(),
            details: None,
        })
}

fn preview_response(bytes: Vec<u8>) -> Response {
    Response::new(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tauri::ipc::{InvokeResponseBody, IpcResponse};

    #[test]
    fn api_authentication_errors_have_stable_public_codes_without_details() {
        let unauthorized = CommandError::from(FreesoundApiError::Unauthorized);
        let rate_limited = CommandError::from(FreesoundApiError::RateLimited);

        assert_eq!(unauthorized.code, "freesound_unauthorized");
        assert_eq!(rate_limited.code, "freesound_rate_limited");
        assert_eq!(unauthorized.details, None);
        assert_eq!(rate_limited.details, None);
    }

    #[test]
    fn preview_response_uses_raw_ipc_bytes() {
        let body = preview_response(vec![0, 127, 255])
            .body()
            .expect("response body");

        match body {
            InvokeResponseBody::Raw(bytes) => assert_eq!(bytes, vec![0, 127, 255]),
            InvokeResponseBody::Json(_) => panic!("expected raw preview bytes"),
        }
    }

    #[test]
    fn preview_download_errors_have_stable_public_codes_without_details() {
        let invalid_destination = CommandError::from(PreviewDownloadError::InvalidDestination);
        let storage_failure = CommandError::from(PreviewDownloadError::Storage(
            std::io::Error::other("disk full"),
        ));

        assert_eq!(
            invalid_destination.code,
            "freesound_download_destination_invalid"
        );
        assert_eq!(storage_failure.code, "freesound_download_storage_failed");
        assert_eq!(storage_failure.details, None);
    }
}
