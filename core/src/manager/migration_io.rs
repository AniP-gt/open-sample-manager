use std::ffi::OsString;
use std::fs;
use std::io::{Error as IoError, ErrorKind};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use super::ManagerError;

pub(super) fn checkpoint_truncate(conn: &rusqlite::Connection) -> Result<(), ManagerError> {
    conn.query_row("PRAGMA wal_checkpoint(TRUNCATE)", [], |_| Ok(()))?;
    Ok(())
}

pub(super) fn replace_file(source: &Path, target: &Path) -> Result<(), ManagerError> {
    #[cfg(unix)]
    {
        fs::rename(source, target)?;
        Ok(())
    }

    #[cfg(not(unix))]
    {
        replace_file_with_backup(source, target)
    }
}

#[cfg(not(unix))]
fn replace_file_with_backup(source: &Path, target: &Path) -> Result<(), ManagerError> {
    let backup = unique_path(
        target
            .parent()
            .ok_or_else(|| invalid_input("target path must have a parent directory"))?,
        "replace.backup",
    );
    if target.exists() {
        fs::rename(target, &backup)?;
    }
    if let Err(error) = fs::rename(source, target) {
        if backup.exists() {
            let _ = fs::rename(&backup, target);
        }
        return Err(ManagerError::Io(error));
    }
    if backup.exists() {
        fs::remove_file(backup)?;
    }
    Ok(())
}

pub(super) fn cleanup_sqlite_sidecars(path: &Path) -> Result<(), ManagerError> {
    remove_if_exists(path)?;
    remove_if_exists(&sidecar_path(path, "-wal"))?;
    remove_if_exists(&sidecar_path(path, "-shm"))?;
    Ok(())
}

fn remove_if_exists(path: &Path) -> Result<(), ManagerError> {
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(()),
        Err(error) => Err(ManagerError::Io(error)),
    }
}

fn sidecar_path(path: &Path, suffix: &str) -> PathBuf {
    let mut value: OsString = path.as_os_str().to_os_string();
    value.push(suffix);
    PathBuf::from(value)
}

pub(super) fn unique_path(parent: &Path, name: &str) -> PathBuf {
    parent.join(format!(
        "{}.{}.{}",
        name,
        std::process::id(),
        now_unix_seconds().unwrap_or(0)
    ))
}

pub(super) fn path_to_string(path: &Path) -> Result<String, ManagerError> {
    path.to_str()
        .map(str::to_string)
        .ok_or_else(|| invalid_input("path must be valid UTF-8"))
}

pub(super) fn now_unix_seconds() -> Result<u64, ManagerError> {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .map_err(|error| invalid_data(format!("system clock is before UNIX epoch: {error}")))
}

pub(super) fn invalid_data(message: impl Into<String>) -> ManagerError {
    ManagerError::Io(IoError::new(ErrorKind::InvalidData, message.into()))
}

pub(super) fn invalid_input(message: impl Into<String>) -> ManagerError {
    ManagerError::Io(IoError::new(ErrorKind::InvalidInput, message.into()))
}
