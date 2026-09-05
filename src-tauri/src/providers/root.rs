use std::{
    fs,
    path::{Path, PathBuf},
};

#[derive(Clone, Debug)]
pub(crate) struct DownloadRoot {
    root: PathBuf,
}

#[derive(Debug, thiserror::Error)]
pub(crate) enum ProviderRootError {
    #[error("download root must be an existing absolute directory")]
    InvalidRoot,
    #[error("download root cannot host private staging")]
    UnusableRoot,
    #[error("download root storage failed")]
    Storage(#[from] std::io::Error),
}

impl DownloadRoot {
    pub(crate) fn from_optional(
        root: Option<String>,
        app_data: PathBuf,
    ) -> Result<Self, ProviderRootError> {
        match root {
            Some(root) => Self::validate(PathBuf::from(root)),
            None => {
                fs::create_dir_all(&app_data)?;
                Self::validate(app_data)
            }
        }
    }

    pub(crate) fn root(&self) -> &Path {
        &self.root
    }

    pub(crate) fn revalidate(&self) -> Result<(), ProviderRootError> {
        let metadata = fs::symlink_metadata(&self.root)?;
        if metadata.file_type().is_symlink() || !metadata.is_dir() {
            return Err(ProviderRootError::UnusableRoot);
        }
        Ok(())
    }

    fn validate(root: PathBuf) -> Result<Self, ProviderRootError> {
        if !root.is_absolute()
            || !root.is_dir()
            || fs::symlink_metadata(&root)?.file_type().is_symlink()
        {
            return Err(ProviderRootError::InvalidRoot);
        }
        let canonical_root = fs::canonicalize(root)?;
        remove_empty_legacy_imports(&canonical_root)?;
        Ok(Self {
            root: canonical_root,
        })
    }
}

fn remove_empty_legacy_imports(root: &Path) -> Result<(), ProviderRootError> {
    let legacy = root.join("provider-imports");
    let Ok(metadata) = fs::symlink_metadata(&legacy) else {
        return Ok(());
    };
    if metadata.file_type().is_symlink() {
        return Err(ProviderRootError::UnusableRoot);
    }
    if metadata.is_dir() && fs::read_dir(&legacy)?.next().transpose()?.is_none() {
        fs::remove_dir(legacy)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{DownloadRoot, ProviderRootError};

    #[test]
    fn retains_the_canonical_selected_root_without_creating_provider_imports() {
        // Given: a user-selected directory.
        let root = tempfile::tempdir().expect("root");

        // When: the directory becomes the provider download root.
        let validated = DownloadRoot::from_optional(
            Some(root.path().to_string_lossy().into_owned()),
            root.path().join("app"),
        )
        .expect("valid root");

        // Then: imports use the canonical selected root directly.
        assert_eq!(
            validated.root(),
            root.path().canonicalize().expect("canonical root")
        );
        assert!(!root.path().join("provider-imports").exists());
    }

    #[test]
    fn removes_an_empty_legacy_provider_imports_directory() {
        // Given: an empty legacy provider imports directory.
        let root = tempfile::tempdir().expect("root");
        let legacy_imports = root.path().join("provider-imports");
        std::fs::create_dir(&legacy_imports).expect("legacy imports");

        // When: the directory becomes the provider download root.
        let validated = DownloadRoot::from_optional(
            Some(root.path().to_string_lossy().into_owned()),
            root.path().join("app"),
        )
        .expect("valid root");

        // Then: the empty legacy wrapper is removed and the selected root is retained.
        assert_eq!(
            validated.root(),
            root.path().canonicalize().expect("canonical root")
        );
        assert!(!legacy_imports.exists());
    }

    #[test]
    fn preserves_a_non_empty_legacy_provider_imports_directory() {
        // Given: legacy provider data that must not be deleted.
        let root = tempfile::tempdir().expect("root");
        let legacy_imports = root.path().join("provider-imports");
        std::fs::create_dir(&legacy_imports).expect("legacy imports");
        let legacy_file = legacy_imports.join("existing.wav");
        std::fs::write(&legacy_file, b"RIFFxxxxWAVE").expect("legacy file");

        // When: the directory becomes the provider download root.
        let validated = DownloadRoot::from_optional(
            Some(root.path().to_string_lossy().into_owned()),
            root.path().join("app"),
        )
        .expect("valid root");

        // Then: imports use the selected root without deleting legacy data.
        assert_eq!(
            validated.root(),
            root.path().canonicalize().expect("canonical root")
        );
        assert_eq!(
            std::fs::read(legacy_file).expect("legacy data"),
            b"RIFFxxxxWAVE"
        );
    }

    #[test]
    fn rejects_relative_missing_and_file_roots() {
        let parent = tempfile::tempdir().expect("parent");
        let file = parent.path().join("file");
        std::fs::write(&file, b"x").expect("file");
        for root in [
            "relative",
            parent.path().join("missing").to_str().expect("utf8"),
            file.to_str().expect("utf8"),
        ] {
            assert!(matches!(
                DownloadRoot::from_optional(Some(root.to_string()), parent.path().join("app")),
                Err(ProviderRootError::InvalidRoot)
            ));
        }
    }

    #[cfg(unix)]
    #[test]
    fn rejects_symlink_custom_roots_and_import_directories() {
        use std::os::unix::fs::symlink;

        let parent = tempfile::tempdir().expect("parent");
        let target = parent.path().join("target");
        std::fs::create_dir(&target).expect("target");
        let root_link = parent.path().join("root-link");
        symlink(&target, &root_link).expect("root link");
        assert!(matches!(
            DownloadRoot::from_optional(
                Some(root_link.to_string_lossy().into_owned()),
                parent.path().join("app")
            ),
            Err(ProviderRootError::InvalidRoot)
        ));

        let root = parent.path().join("root");
        std::fs::create_dir(&root).expect("root");
        let imports = root.join("provider-imports");
        symlink(&target, &imports).expect("imports link");
        assert!(matches!(
            DownloadRoot::from_optional(
                Some(root.to_string_lossy().into_owned()),
                parent.path().join("app")
            ),
            Err(ProviderRootError::UnusableRoot)
        ));
    }

    #[cfg(unix)]
    #[test]
    fn accepts_a_readable_root_without_eager_staging_creation() {
        use std::os::unix::fs::PermissionsExt;

        let root = tempfile::tempdir().expect("root");
        let original_permissions = std::fs::metadata(root.path())
            .expect("root metadata")
            .permissions();
        std::fs::set_permissions(root.path(), std::fs::Permissions::from_mode(0o555))
            .expect("readable root permissions");

        let result = DownloadRoot::from_optional(
            Some(root.path().to_string_lossy().into_owned()),
            root.path().join("app"),
        );

        std::fs::set_permissions(root.path(), original_permissions)
            .expect("restore root permissions");
        assert!(result.is_ok());
    }
}
