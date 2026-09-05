use std::{
    collections::HashSet,
    io::{Read, Seek},
    path::{Component, Path, PathBuf},
};

use zip::ZipArchive;

use super::{
    super::{
        collision::portable_name_key,
        validation::{is_allowed_extension, is_archive, signature_matches},
    },
    ArchiveError, MAX_DEPTH, MAX_ENTRIES, MAX_ENTRY_SIZE, MAX_RATIO, MAX_TOTAL_SIZE,
};

pub(super) struct ApprovedEntry {
    pub(super) index: usize,
    pub(super) path: PathBuf,
    pub(super) declared_size: u64,
}

pub(super) fn approved_entries<R: Read + Seek>(
    archive: &mut ZipArchive<R>,
) -> Result<Vec<ApprovedEntry>, ArchiveError> {
    if archive.len() > MAX_ENTRIES {
        return Err(ArchiveError::Unsafe("too many entries"));
    }
    let mut total = 0_u64;
    let mut names = HashSet::new();
    let mut approved = Vec::new();
    for index in 0..archive.len() {
        let mut entry = archive.by_index(index)?;
        if entry.is_dir() {
            continue;
        }
        if entry.encrypted()
            || entry
                .unix_mode()
                .is_some_and(|mode| mode & 0o170000 != 0o100000)
        {
            return Err(ArchiveError::Unsafe("non-regular or encrypted entry"));
        }
        let path = safe_path(entry.name())?;
        if !is_allowed_extension(&path) {
            return Err(ArchiveError::Unsafe("unsupported file type"));
        }
        if is_archive(&path) {
            return Err(ArchiveError::Unsafe("nested archive"));
        }
        if !signature_matches(&mut entry, &path)? {
            return Err(ArchiveError::Unsafe("file signature mismatch"));
        }
        let compressed = entry.compressed_size();
        let size = entry.size();
        if size > MAX_ENTRY_SIZE
            || total
                .checked_add(size)
                .filter(|value| *value <= MAX_TOTAL_SIZE)
                .is_none()
        {
            return Err(ArchiveError::Unsafe("extraction size limit"));
        }
        if compressed == 0 || size / compressed > MAX_RATIO {
            return Err(ArchiveError::Unsafe("compression ratio limit"));
        }
        total += size;
        let basename = path
            .file_name()
            .ok_or(ArchiveError::Unsafe("missing file name"))?;
        if !names.insert(portable_name_key(basename)) {
            return Err(ArchiveError::Unsafe("normalized path collision"));
        }
        approved.push(ApprovedEntry {
            index,
            path: PathBuf::from(basename),
            declared_size: size,
        });
    }
    if approved.is_empty() {
        return Err(ArchiveError::Unsafe("archive has no approved files"));
    }
    Ok(approved)
}

fn safe_path(name: &str) -> Result<PathBuf, ArchiveError> {
    if name.is_empty() || name.contains('\\') || name.chars().any(char::is_control) {
        return Err(ArchiveError::Unsafe("invalid path characters"));
    }
    let path = Path::new(name);
    if path.is_absolute() || name.starts_with("//") || name.contains(':') {
        return Err(ArchiveError::Unsafe("absolute or drive path"));
    }
    let components = path.components().collect::<Vec<_>>();
    if components.len() > MAX_DEPTH
        || components
            .iter()
            .any(|component| !matches!(component, Component::Normal(_)))
    {
        return Err(ArchiveError::Unsafe("path traversal or depth"));
    }
    if components
        .iter()
        .any(|component| is_windows_reserved_name(component.as_os_str()))
    {
        return Err(ArchiveError::Unsafe("windows reserved path"));
    }
    if components.iter().any(|component| {
        component
            .as_os_str()
            .to_string_lossy()
            .ends_with(['.', ' '])
    }) {
        return Err(ArchiveError::Unsafe("windows ambiguous path"));
    }
    Ok(path.to_path_buf())
}

fn is_windows_reserved_name(component: &std::ffi::OsStr) -> bool {
    let name = component.to_string_lossy();
    let stem = name
        .split('.')
        .next()
        .unwrap_or_default()
        .to_ascii_uppercase();
    matches!(stem.as_str(), "CON" | "PRN" | "AUX" | "NUL")
        || stem.strip_prefix("COM").is_some_and(|number| {
            matches!(number, "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9")
        })
        || stem.strip_prefix("LPT").is_some_and(|number| {
            matches!(number, "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9")
        })
}
