use open_sample_manager_core::analysis::processed_wav::ProcessedWavError;
use open_sample_manager_core::SampleManager;
use serde::Serialize;
use std::error::Error as _;

use crate::app_state::AppState;

#[derive(Debug, Serialize, Clone)]
pub(crate) struct CommandError {
    pub(crate) code: String,
    pub(crate) message: String,
    pub(crate) details: Option<String>,
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
        let details = value.source().map(|error| error.to_string());

        Self {
            code,
            message: value.to_string(),
            details,
        }
    }
}

impl From<ProcessedWavError> for CommandError {
    fn from(value: ProcessedWavError) -> Self {
        let details = value.source().map(|error| error.to_string());
        Self {
            code: "processed_wav_error".to_string(),
            message: format!("processed WAV error: {value}"),
            details,
        }
    }
}

pub(crate) fn get_manager(state: &AppState) -> std::sync::MutexGuard<'_, SampleManager> {
    state.lock_manager()
}
