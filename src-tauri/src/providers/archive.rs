use std::{fs, io, path::Path};

mod extraction;
mod preflight;

const MAX_ENTRIES: usize = 5_000;
const MAX_ENTRY_SIZE: u64 = 256 * 1024 * 1024;
const MAX_TOTAL_SIZE: u64 = 2 * 1024 * 1024 * 1024;
const MAX_RATIO: u64 = 100;
const MAX_DEPTH: usize = 8;
const DISK_RESERVE: u64 = 512 * 1024 * 1024;

#[derive(Debug, thiserror::Error)]
pub(crate) enum ArchiveError {
    #[error("unsafe archive: {0}")]
    Unsafe(&'static str),
    #[error("archive I/O failed: {0}")]
    Io(#[from] io::Error),
    #[error("archive parsing failed: {0}")]
    Zip(#[from] zip::result::ZipError),
}

struct ExtractionCleanup<'path> {
    path: &'path Path,
    active: bool,
}

impl ExtractionCleanup<'_> {
    fn disarm(mut self) {
        self.active = false;
    }
}

impl Drop for ExtractionCleanup<'_> {
    fn drop(&mut self) {
        if self.active {
            let _ = fs::remove_dir_all(self.path);
        }
    }
}

pub(crate) fn extract_approved_archive(
    archive_path: &Path,
    staging: &Path,
) -> Result<(), ArchiveError> {
    let cleanup = ExtractionCleanup {
        path: staging,
        active: true,
    };
    extraction::extract(archive_path, staging)?;
    cleanup.disarm();
    Ok(())
}

#[cfg(test)]
#[path = "archive_tests/mod.rs"]
mod tests;
