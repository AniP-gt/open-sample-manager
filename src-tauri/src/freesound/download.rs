use std::{
    fs,
    io::{self, Write},
    path::{Path, PathBuf},
};

#[derive(Debug, thiserror::Error)]
pub(crate) enum PreviewDownloadError {
    #[error("Freesound download destination must be an existing absolute directory")]
    InvalidDestination,
    #[error("Freesound preview destination already exists")]
    DestinationExists,
    #[error("Freesound preview storage failed")]
    Storage(#[source] io::Error),
}

pub(crate) fn sanitize_preview_filename(name: &str) -> String {
    let stem = name.rsplit_once('.').map_or(name, |(stem, _)| stem);
    let safe_stem: String = stem
        .chars()
        .map(|character| match character {
            'A'..='Z' | 'a'..='z' | '0'..='9' | ' ' | '-' | '_' => character,
            _ => '_',
        })
        .take(120)
        .collect();
    let stem = safe_stem.trim_matches([' ', '_']);
    let stem = if stem.is_empty() {
        "freesound-preview"
    } else {
        stem
    };
    format!("{stem}.mp3")
}

pub(crate) fn write_preview_download(
    destination: &Path,
    result_name: &str,
    bytes: &[u8],
) -> Result<PathBuf, PreviewDownloadError> {
    validate_destination(destination)?;
    let final_path = destination.join(sanitize_preview_filename(result_name));
    let mut temporary = tempfile::Builder::new()
        .prefix(".freesound-")
        .suffix(".tmp")
        .tempfile_in(destination)
        .map_err(PreviewDownloadError::Storage)?;
    temporary
        .write_all(bytes)
        .and_then(|()| temporary.as_file().sync_all())
        .map_err(PreviewDownloadError::Storage)?;
    temporary.persist_noclobber(&final_path).map_err(|error| {
        if error.error.kind() == io::ErrorKind::AlreadyExists {
            PreviewDownloadError::DestinationExists
        } else {
            PreviewDownloadError::Storage(error.error)
        }
    })?;
    Ok(final_path)
}

fn validate_destination(destination: &Path) -> Result<(), PreviewDownloadError> {
    if !destination.is_absolute() {
        return Err(PreviewDownloadError::InvalidDestination);
    }
    let metadata = fs::symlink_metadata(destination).map_err(|error| match error.kind() {
        io::ErrorKind::NotFound => PreviewDownloadError::InvalidDestination,
        _ => PreviewDownloadError::Storage(error),
    })?;
    if metadata.file_type().is_symlink() || !metadata.is_dir() {
        return Err(PreviewDownloadError::InvalidDestination);
    }
    Ok(())
}
