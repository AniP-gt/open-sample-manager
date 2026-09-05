use std::{fs::File, io::Read, path::Path};

use super::archive::ArchiveError;

pub(crate) fn is_allowed_extension(path: &Path) -> bool {
    path.extension()
        .and_then(|value| value.to_str())
        .is_some_and(|value| {
            matches!(
                value.to_ascii_lowercase().as_str(),
                "wav" | "mp3" | "flac" | "ogg" | "aiff" | "mid" | "midi"
            )
        })
}

pub(crate) fn is_archive(path: &Path) -> bool {
    path.extension()
        .and_then(|value| value.to_str())
        .is_some_and(|value| {
            matches!(
                value.to_ascii_lowercase().as_str(),
                "zip" | "tar" | "gz" | "7z" | "rar"
            )
        })
}

pub(crate) fn signature_matches(entry: &mut impl Read, path: &Path) -> Result<bool, ArchiveError> {
    let mut header = [0_u8; 12];
    let length = entry.read(&mut header)?;
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    Ok(match extension.as_str() {
        "wav" => length >= 12 && &header[..4] == b"RIFF" && &header[8..12] == b"WAVE",
        "flac" => length >= 4 && &header[..4] == b"fLaC",
        "ogg" => length >= 4 && &header[..4] == b"OggS",
        "aiff" => {
            length >= 12
                && &header[..4] == b"FORM"
                && (&header[8..12] == b"AIFF" || &header[8..12] == b"AIFC")
        }
        "mid" | "midi" => length >= 4 && &header[..4] == b"MThd",
        "mp3" => {
            length >= 3
                && (&header[..3] == b"ID3" || (header[0] == 0xff && header[1] & 0xe0 == 0xe0))
        }
        _ => false,
    })
}

pub(crate) fn validate_approved_file(path: &Path) -> Result<(), ArchiveError> {
    if !is_allowed_extension(path) {
        return Err(ArchiveError::Unsafe("unsupported file type"));
    }
    let mut file = File::open(path)?;
    if signature_matches(&mut file, path)? {
        Ok(())
    } else {
        Err(ArchiveError::Unsafe("file signature mismatch"))
    }
}
