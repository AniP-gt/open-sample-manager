use std::{
    fmt, fs, io,
    path::{Path, PathBuf},
};

use serde::{Deserialize, Serialize};

const CREDENTIAL_FILE: &str = "freesound.json";
const MIN_API_KEY_LENGTH: usize = 16;
const MAX_API_KEY_LENGTH: usize = 512;

pub(crate) struct FreesoundApiKey(String);

impl FreesoundApiKey {
    pub(crate) fn parse(value: &str) -> Result<Self, FreesoundCredentialError> {
        let value = value.trim();
        if !(MIN_API_KEY_LENGTH..=MAX_API_KEY_LENGTH).contains(&value.len())
            || !value.bytes().all(|byte| byte.is_ascii_alphanumeric())
        {
            return Err(FreesoundCredentialError::InvalidKey);
        }
        Ok(Self(value.to_owned()))
    }

    pub(crate) fn secret(&self) -> &str {
        &self.0
    }
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub(crate) struct CredentialStatus {
    pub configured: bool,
}

#[derive(Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
struct CredentialFile {
    api_key: String,
}

#[derive(Debug)]
pub(crate) enum FreesoundCredentialError {
    InvalidKey,
    Read(io::Error),
    Write,
    Parse,
}

impl fmt::Display for FreesoundCredentialError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidKey => formatter.write_str("Freesound API key format is invalid"),
            Self::Read(_) => formatter.write_str("Freesound credential could not be read"),
            Self::Write => formatter.write_str("Freesound credential could not be saved"),
            Self::Parse => formatter.write_str("Freesound credential is invalid"),
        }
    }
}

impl std::error::Error for FreesoundCredentialError {}

pub(crate) fn credential_path(config_dir: &Path) -> PathBuf {
    config_dir.join(CREDENTIAL_FILE)
}

pub(crate) fn credential_status(path: &Path) -> Result<CredentialStatus, FreesoundCredentialError> {
    match read_credential(path) {
        Ok(_) => Ok(CredentialStatus { configured: true }),
        Err(FreesoundCredentialError::Read(error)) if error.kind() == io::ErrorKind::NotFound => {
            Ok(CredentialStatus { configured: false })
        }
        Err(error) => Err(error),
    }
}

pub(crate) fn save_credential(
    path: &Path,
    key: FreesoundApiKey,
) -> Result<CredentialStatus, FreesoundCredentialError> {
    let parent = path.parent().unwrap_or_else(|| Path::new("."));
    fs::create_dir_all(parent).map_err(|_| FreesoundCredentialError::Write)?;
    let payload = CredentialFile { api_key: key.0 };
    let mut temporary = tempfile::Builder::new()
        .prefix(".freesound-")
        .suffix(".tmp")
        .tempfile_in(parent)
        .map_err(|_| FreesoundCredentialError::Write)?;
    apply_private_permissions(temporary.as_file()).map_err(|_| FreesoundCredentialError::Write)?;
    serde_json::to_writer(&mut temporary, &payload).map_err(|_| FreesoundCredentialError::Parse)?;
    temporary
        .as_file_mut()
        .sync_all()
        .map_err(|_| FreesoundCredentialError::Write)?;
    temporary
        .persist(path)
        .map_err(|_| FreesoundCredentialError::Write)?;
    Ok(CredentialStatus { configured: true })
}

pub(crate) fn delete_credential(path: &Path) -> Result<CredentialStatus, FreesoundCredentialError> {
    match fs::remove_file(path) {
        Ok(()) => Ok(CredentialStatus { configured: false }),
        Err(error) if error.kind() == io::ErrorKind::NotFound => {
            Ok(CredentialStatus { configured: false })
        }
        Err(_) => Err(FreesoundCredentialError::Write),
    }
}

pub(crate) fn read_credential(path: &Path) -> Result<FreesoundApiKey, FreesoundCredentialError> {
    let bytes = fs::read(path).map_err(FreesoundCredentialError::Read)?;
    let file = serde_json::from_slice::<CredentialFile>(&bytes)
        .map_err(|_| FreesoundCredentialError::Parse)?;
    FreesoundApiKey::parse(&file.api_key)
}

#[cfg(unix)]
fn apply_private_permissions(file: &fs::File) -> io::Result<()> {
    use std::os::unix::fs::PermissionsExt;
    file.set_permissions(fs::Permissions::from_mode(0o600))
}

#[cfg(not(unix))]
fn apply_private_permissions(_file: &fs::File) -> io::Result<()> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{
        credential_path, credential_status, delete_credential, save_credential, FreesoundApiKey,
    };
    use tempfile::tempdir;

    #[test]
    fn credential_lifecycle_exposes_only_configured_status() {
        let directory = tempdir().expect("config directory");
        let path = credential_path(directory.path());
        let key = FreesoundApiKey::parse(&"a".repeat(16)).expect("valid key");

        assert!(!credential_status(&path).expect("initial status").configured);
        assert!(
            save_credential(&path, key)
                .expect("saved status")
                .configured
        );
        assert!(!delete_credential(&path).expect("deleted status").configured);
    }

    #[test]
    fn credential_status_serializes_without_secret_fields() {
        let status = super::CredentialStatus { configured: true };

        assert_eq!(
            serde_json::to_value(status).expect("status JSON"),
            serde_json::json!({ "configured": true })
        );
    }

    #[test]
    fn failed_replacement_preserves_existing_credential() {
        let directory = tempdir().expect("config directory");
        let path = credential_path(directory.path());
        let original = FreesoundApiKey::parse(&"a".repeat(16)).expect("valid original");
        save_credential(&path, original).expect("initial credential");

        let result = save_credential(
            &path.join("child"),
            FreesoundApiKey::parse(&"b".repeat(16)).expect("valid replacement"),
        );

        assert!(result.is_err());
        assert!(
            credential_status(&path)
                .expect("original credential status")
                .configured
        );
    }

    #[cfg(unix)]
    #[test]
    fn saved_credential_is_owner_read_write_only() {
        use std::os::unix::fs::PermissionsExt;
        let directory = tempdir().expect("config directory");
        let path = credential_path(directory.path());

        save_credential(
            &path,
            FreesoundApiKey::parse(&"a".repeat(16)).expect("valid key"),
        )
        .expect("save credential");

        assert_eq!(
            std::fs::metadata(path)
                .expect("credential metadata")
                .permissions()
                .mode()
                & 0o777,
            0o600
        );
    }
}
