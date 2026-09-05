use std::{
    collections::HashSet,
    fs::{self, File, OpenOptions},
    io,
    path::{Path, PathBuf},
};

use super::collision::portable_name_key;

#[derive(Debug, thiserror::Error)]
pub(crate) enum PromotionError {
    #[error("provider import destination already exists")]
    Conflict,
    #[error("provider import promotion failed: {0}")]
    Io(#[from] std::io::Error),
}

struct PromotionRollback {
    created: Vec<PathBuf>,
    active: bool,
}

impl PromotionRollback {
    fn new() -> Self {
        Self {
            created: Vec::new(),
            active: true,
        }
    }

    fn record(&mut self, destination: PathBuf) {
        self.created.push(destination);
    }

    fn disarm(mut self) {
        self.active = false;
    }
}

impl Drop for PromotionRollback {
    fn drop(&mut self) {
        if self.active {
            for path in &self.created {
                let _ = fs::remove_file(path);
            }
        }
    }
}

pub(crate) fn promote_approved_files(staging: &Path, root: &Path) -> Result<(), PromotionError> {
    let sources = staged_files(staging)?;
    preflight_collisions(&sources, root)?;
    let mut rollback = PromotionRollback::new();

    for source in sources {
        let name = source
            .file_name()
            .ok_or_else(|| std::io::Error::other("staged file has no name"))?;
        let destination = root.join(name);
        copy_without_overwrite(&source, destination, &mut rollback)?;
        fs::remove_file(source)?;
    }

    rollback.disarm();
    Ok(())
}

fn copy_without_overwrite(
    source: &Path,
    destination: PathBuf,
    rollback: &mut PromotionRollback,
) -> Result<(), PromotionError> {
    let mut input = File::open(source)?;
    let mut output = match OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&destination)
    {
        Ok(output) => output,
        Err(error) if error.kind() == io::ErrorKind::AlreadyExists => {
            return Err(PromotionError::Conflict);
        }
        Err(error) => return Err(error.into()),
    };
    rollback.record(destination);
    io::copy(&mut input, &mut output)?;
    output.sync_all()?;
    Ok(())
}

fn staged_files(staging: &Path) -> Result<Vec<PathBuf>, PromotionError> {
    let mut files = Vec::new();
    for entry in fs::read_dir(staging)? {
        let entry = entry?;
        if !entry.file_type()?.is_file() {
            return Err(std::io::Error::other("staging contains a non-file entry").into());
        }
        files.push(entry.path());
    }
    files.sort();
    Ok(files)
}

fn preflight_collisions(sources: &[PathBuf], root: &Path) -> Result<(), PromotionError> {
    let mut names = HashSet::new();
    for entry in fs::read_dir(root)? {
        let entry = entry?;
        names.insert(portable_name_key(&entry.file_name()));
    }

    for source in sources {
        let name = source
            .file_name()
            .ok_or_else(|| std::io::Error::other("staged file has no name"))?;
        if !names.insert(portable_name_key(name)) {
            return Err(PromotionError::Conflict);
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{promote_approved_files, PromotionError};

    #[cfg(unix)]
    use std::os::unix::fs::MetadataExt;

    #[test]
    fn promotes_flat_staged_files_into_the_selected_root() {
        // Given: approved files staged beneath a selected root.
        let root = tempfile::tempdir().expect("root");
        let staging = tempfile::tempdir_in(root.path()).expect("staging");
        std::fs::write(staging.path().join("kick.wav"), b"RIFFxxxxWAVE").expect("kick");
        std::fs::write(staging.path().join("pattern.mid"), b"MThd\0\0\0\x06").expect("pattern");

        // When: the staged files are promoted.
        promote_approved_files(staging.path(), root.path()).expect("promotion");

        // Then: only root-level files remain for scanning.
        assert!(root.path().join("kick.wav").is_file());
        assert!(root.path().join("pattern.mid").is_file());
        assert!(!staging.path().join("kick.wav").exists());
        assert!(!staging.path().join("pattern.mid").exists());
    }

    #[cfg(unix)]
    #[test]
    fn promotes_by_copying_instead_of_hard_linking() {
        let root = tempfile::tempdir().expect("root");
        let staging = tempfile::tempdir_in(root.path()).expect("staging");
        let source = staging.path().join("kick.wav");
        std::fs::write(&source, b"RIFFxxxxWAVE").expect("source");
        let source_inode = std::fs::metadata(&source).expect("source metadata").ino();

        promote_approved_files(staging.path(), root.path()).expect("promotion");

        let destination = root.path().join("kick.wav");
        assert_eq!(
            std::fs::read(&destination).expect("destination"),
            b"RIFFxxxxWAVE"
        );
        assert_ne!(
            std::fs::metadata(destination)
                .expect("destination metadata")
                .ino(),
            source_inode
        );
    }

    #[test]
    fn preflight_conflict_preserves_existing_root_entries() {
        // Given: an existing portable-equivalent root entry.
        let root = tempfile::tempdir().expect("root");
        let staging = tempfile::tempdir_in(root.path()).expect("staging");
        std::fs::write(root.path().join("KICK.wav"), b"existing").expect("existing");
        std::fs::write(staging.path().join("kick.wav"), b"incoming").expect("incoming");

        // When: promotion finds the collision before moving any file.
        let result = promote_approved_files(staging.path(), root.path());

        // Then: the root entry and staging source are both unchanged.
        assert!(matches!(result, Err(PromotionError::Conflict)));
        assert_eq!(
            std::fs::read(root.path().join("KICK.wav")).expect("existing"),
            b"existing"
        );
        assert_eq!(
            std::fs::read(staging.path().join("kick.wav")).expect("incoming"),
            b"incoming"
        );
    }
}
