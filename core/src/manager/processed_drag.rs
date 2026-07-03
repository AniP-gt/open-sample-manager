use std::path::{Path, PathBuf};

use crate::analysis::processed_wav::{render_processed_wav, ProcessedSampleRenderSeconds};

use super::{ManagerError, SampleManager};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProcessedDragFile {
    pub path: PathBuf,
}

impl SampleManager {
    pub fn prepare_processed_drag_file(
        &self,
        source_path: impl AsRef<Path>,
        output_path: impl AsRef<Path>,
        params: ProcessedSampleRenderSeconds,
    ) -> Result<ProcessedDragFile, ManagerError> {
        render_processed_wav(source_path.as_ref(), output_path.as_ref(), params)?;
        Ok(ProcessedDragFile {
            path: output_path.as_ref().to_path_buf(),
        })
    }
}
