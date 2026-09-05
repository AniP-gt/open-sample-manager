use std::path::PathBuf;

use url::Url;

use super::{
    archive::extract_approved_archive,
    download::DownloadError,
    policy::ProviderPolicyError,
    promotion::{promote_approved_files, PromotionError},
    root::DownloadRoot,
    validation::validate_approved_file,
};

pub(super) struct DownloadFinalization {
    pub(super) root: DownloadRoot,
    pub(super) url: Url,
    pub(super) download_path: PathBuf,
    pub(super) unpacked_path: PathBuf,
}

pub(super) fn finalize_download(
    finalization: DownloadFinalization,
) -> Result<PathBuf, DownloadError> {
    let DownloadFinalization {
        root,
        url,
        download_path,
        unpacked_path,
    } = finalization;
    if url.path().ends_with(".zip") {
        extract_approved_archive(&download_path, &unpacked_path)?;
    } else {
        validate_approved_file(&download_path)?;
        std::fs::create_dir(&unpacked_path)?;
        let filename = url
            .path_segments()
            .and_then(Iterator::last)
            .filter(|name| !name.is_empty())
            .ok_or(ProviderPolicyError::UnapprovedUrl)?;
        std::fs::rename(download_path, unpacked_path.join(filename))?;
    }
    root.revalidate()
        .map_err(|_| DownloadError::InsufficientSpace)?;
    match promote_approved_files(&unpacked_path, root.root()) {
        Ok(()) => Ok(root.root().to_path_buf()),
        Err(PromotionError::Conflict) => Err(DownloadError::PromotionConflict),
        Err(PromotionError::Io(error)) => Err(DownloadError::Io(error)),
    }
}

#[cfg(test)]
mod tests {
    use super::{finalize_download, DownloadFinalization};
    use crate::providers::DownloadRoot;

    #[test]
    fn finalization_promotes_an_approved_archive_into_the_selected_root() {
        let root_directory = tempfile::tempdir().expect("root");
        let root = DownloadRoot::from_optional(
            Some(root_directory.path().to_string_lossy().into_owned()),
            root_directory.path().join("app-data"),
        )
        .expect("root");
        let staging = tempfile::tempdir_in(root.root()).expect("staging");
        let download_path = staging.path().join("download.bin");
        let mut archive =
            zip::ZipWriter::new(std::fs::File::create(&download_path).expect("download archive"));
        archive
            .start_file("kit/kick.wav", zip::write::SimpleFileOptions::default())
            .expect("archive entry");
        std::io::Write::write_all(&mut archive, b"RIFFxxxxWAVE").expect("archive body");
        archive.finish().expect("archive finish");
        let finalization = DownloadFinalization {
            root,
            url: "https://example.test/kit.zip".parse().expect("URL"),
            download_path,
            unpacked_path: staging.path().join("approved"),
        };

        let directory = finalize_download(finalization).expect("finalization");

        assert_eq!(
            directory,
            root_directory.path().canonicalize().expect("root path")
        );
        assert!(root_directory.path().join("kick.wav").is_file());
    }
}
