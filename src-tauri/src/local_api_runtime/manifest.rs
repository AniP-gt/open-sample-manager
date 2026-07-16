use chrono::{SecondsFormat, Utc};
use serde::{Deserialize, Serialize};
use std::fmt;
use std::fs::{self, OpenOptions};
use std::io::{self, Read, Write};
use std::path::{Path, PathBuf};

pub const LOCAL_API_MANIFEST_FILE: &str = "localhost-api-connection.json";
pub const LOCAL_API_BASE_URL: &str = "http://127.0.0.1:37421/v1";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalApiConnectionManifest {
    pub version: u8,
    pub base_url: String,
    pub token: String,
    pub pid: u32,
    pub instance_id: String,
    pub issued_at: String,
}

#[derive(Debug)]
pub enum LocalApiLifecycleError {
    Bind(io::Error),
    Read(io::Error),
    Parse(serde_json::Error),
    Write(io::Error),
    Persist(io::Error),
}

impl fmt::Display for LocalApiLifecycleError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Bind(error) => write!(f, "failed to bind local API socket: {error}"),
            Self::Read(error) => write!(f, "failed to read local API manifest: {error}"),
            Self::Parse(error) => write!(f, "failed to parse local API manifest: {error}"),
            Self::Write(error) => write!(f, "failed to write local API manifest: {error}"),
            Self::Persist(error) => {
                write!(
                    f,
                    "failed to publish local API manifest atomically: {error}"
                )
            }
        }
    }
}

impl std::error::Error for LocalApiLifecycleError {}

pub fn default_local_api_manifest_path(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join(LOCAL_API_MANIFEST_FILE)
}

pub(super) fn new_manifest(token: String, instance_id: String) -> LocalApiConnectionManifest {
    LocalApiConnectionManifest {
        version: 1,
        base_url: LOCAL_API_BASE_URL.to_string(),
        token,
        pid: std::process::id(),
        instance_id,
        issued_at: Utc::now().to_rfc3339_opts(SecondsFormat::Nanos, true),
    }
}

pub(super) fn cleanup_manifest_after_listener_bind(
    manifest_path: &Path,
) -> Result<bool, LocalApiLifecycleError> {
    remove_file_if_present(manifest_path).map_err(LocalApiLifecycleError::Write)
}

pub(super) fn remove_manifest_if_owned(
    manifest_path: &Path,
    current_pid: u32,
    instance_id: &str,
) -> io::Result<bool> {
    let manifest = match read_connection_manifest(manifest_path) {
        Ok(Some(manifest)) => manifest,
        Ok(None) => return Ok(false),
        Err(LocalApiLifecycleError::Read(error)) => return Err(error),
        Err(error) => return Err(io::Error::other(error.to_string())),
    };

    if manifest.pid != current_pid || manifest.instance_id != instance_id {
        return Ok(false);
    }

    remove_file_if_present(manifest_path)
}

pub(super) fn write_manifest_atomically(
    manifest: &LocalApiConnectionManifest,
    manifest_path: &Path,
) -> Result<(), LocalApiLifecycleError> {
    let parent = manifest_path.parent().unwrap_or_else(|| Path::new("."));
    fs::create_dir_all(parent).map_err(LocalApiLifecycleError::Write)?;

    let mut temp = tempfile::Builder::new()
        .prefix(".localhost-api-")
        .suffix(".tmp")
        .tempfile_in(parent)
        .map_err(LocalApiLifecycleError::Write)?;
    apply_private_manifest_permissions(temp.as_file()).map_err(LocalApiLifecycleError::Write)?;

    let mut serialized =
        serde_json::to_vec_pretty(manifest).map_err(LocalApiLifecycleError::Parse)?;
    serialized.push(b'\n');
    temp.write_all(&serialized)
        .map_err(LocalApiLifecycleError::Write)?;
    temp.as_file_mut()
        .sync_all()
        .map_err(LocalApiLifecycleError::Write)?;

    temp.persist(manifest_path)
        .map(|_| ())
        .map_err(|error| LocalApiLifecycleError::Persist(error.error))
}

pub fn read_connection_manifest(
    manifest_path: &Path,
) -> Result<Option<LocalApiConnectionManifest>, LocalApiLifecycleError> {
    let mut file = match OpenOptions::new().read(true).open(manifest_path) {
        Ok(file) => file,
        Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(LocalApiLifecycleError::Read(error)),
    };
    let mut body = String::new();
    file.read_to_string(&mut body)
        .map_err(LocalApiLifecycleError::Read)?;
    serde_json::from_str(&body)
        .map(Some)
        .map_err(LocalApiLifecycleError::Parse)
}

fn remove_file_if_present(path: &Path) -> io::Result<bool> {
    match fs::remove_file(path) {
        Ok(()) => Ok(true),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(false),
        Err(error) => Err(error),
    }
}

#[cfg(unix)]
fn apply_private_manifest_permissions(file: &std::fs::File) -> io::Result<()> {
    use std::os::unix::fs::PermissionsExt;

    file.set_permissions(std::fs::Permissions::from_mode(0o600))
}

#[cfg(not(unix))]
fn apply_private_manifest_permissions(_file: &std::fs::File) -> io::Result<()> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{
        cleanup_manifest_after_listener_bind, default_local_api_manifest_path, new_manifest,
        read_connection_manifest, remove_manifest_if_owned, write_manifest_atomically,
        LocalApiConnectionManifest, LOCAL_API_BASE_URL, LOCAL_API_MANIFEST_FILE,
    };
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn manifest_path_and_schema_match_mcp_discovery_contract() {
        let app_data = tempdir().expect("temporary app data directory");
        let path = default_local_api_manifest_path(app_data.path());
        let manifest = new_manifest("token".to_string(), "instance".to_string());

        assert_eq!(path, app_data.path().join(LOCAL_API_MANIFEST_FILE));
        assert_eq!(manifest.version, 1);
        assert_eq!(manifest.base_url, LOCAL_API_BASE_URL);
        assert_eq!(manifest.pid, std::process::id());
        assert!(manifest.issued_at.ends_with('Z'));
        let object = serde_json::to_value(manifest).expect("manifest serializes");
        assert_eq!(object.as_object().expect("manifest object").len(), 6);
    }

    #[test]
    fn atomic_manifest_write_round_trips_without_temp_files() {
        let app_data = tempdir().expect("temporary app data directory");
        let path = default_local_api_manifest_path(app_data.path());
        let manifest = new_manifest("token".to_string(), "instance".to_string());

        write_manifest_atomically(&manifest, &path).expect("atomic manifest publication");

        assert_eq!(
            read_connection_manifest(&path)
                .expect("read manifest")
                .expect("manifest")
                .token,
            "token"
        );
        let entries = fs::read_dir(app_data.path()).expect("list app data");
        assert_eq!(entries.count(), 1);
    }

    #[test]
    fn cleanup_leaves_manifest_owned_by_another_instance() {
        let app_data = tempdir().expect("temporary app data directory");
        let path = default_local_api_manifest_path(app_data.path());
        let manifest = LocalApiConnectionManifest {
            version: 1,
            base_url: LOCAL_API_BASE_URL.to_string(),
            token: "token".to_string(),
            pid: std::process::id(),
            instance_id: "other-instance".to_string(),
            issued_at: "2026-01-01T00:00:00Z".to_string(),
        };
        write_manifest_atomically(&manifest, &path).expect("fixture manifest");

        assert!(
            !remove_manifest_if_owned(&path, manifest.pid, "this-instance").expect("cleanup check")
        );
        assert!(path.exists());
    }

    #[test]
    fn manifest_is_removed_after_a_new_listener_binds() {
        let app_data = tempdir().expect("temporary app data directory");
        let path = default_local_api_manifest_path(app_data.path());
        write_manifest_atomically(
            &new_manifest("old-token".to_string(), "old-instance".to_string()),
            &path,
        )
        .expect("stale fixture publication");

        assert!(cleanup_manifest_after_listener_bind(&path).expect("stale owner cleanup"));
        assert!(!path.exists());
    }

    #[test]
    fn failed_atomic_write_does_not_replace_existing_final_path() {
        let app_data = tempdir().expect("temporary app data directory");
        let path = app_data.path().join("manifest-directory");
        fs::create_dir(&path).expect("final path directory");

        let result = write_manifest_atomically(
            &new_manifest("token".to_string(), "instance".to_string()),
            &path,
        );

        assert!(result.is_err());
        assert!(path.is_dir());
    }

    #[cfg(unix)]
    #[test]
    fn unix_manifest_permissions_are_owner_read_write_only() {
        use std::os::unix::fs::PermissionsExt;

        let app_data = tempdir().expect("temporary app data directory");
        let path = default_local_api_manifest_path(app_data.path());
        write_manifest_atomically(
            &new_manifest("token".to_string(), "instance".to_string()),
            &path,
        )
        .expect("manifest publication");

        assert_eq!(
            fs::metadata(path).expect("metadata").permissions().mode() & 0o777,
            0o600
        );
    }

    #[cfg(windows)]
    #[test]
    fn windows_permission_branch_is_a_successful_no_op() {
        use super::apply_private_manifest_permissions;

        let temp = tempfile::NamedTempFile::new().expect("temporary file");
        apply_private_manifest_permissions(temp.as_file()).expect("Windows file protection branch");
    }
}
