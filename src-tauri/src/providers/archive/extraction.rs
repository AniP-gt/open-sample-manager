use std::{
    fs::{self, File, OpenOptions},
    io::{Read, Write},
    path::Path,
};

use zip::ZipArchive;

use super::{
    preflight::approved_entries, ArchiveError, DISK_RESERVE, MAX_ENTRY_SIZE, MAX_TOTAL_SIZE,
};

pub(super) fn extract(archive_path: &Path, staging: &Path) -> Result<(), ArchiveError> {
    let file = File::open(archive_path)?;
    let mut archive = ZipArchive::new(file)?;
    let approved = approved_entries(&mut archive)?;
    let required = approved.iter().try_fold(0_u64, |total, entry| {
        total
            .checked_add(entry.declared_size)
            .ok_or(ArchiveError::Unsafe("extraction size limit"))
    })?;
    if fs2::available_space(
        staging
            .parent()
            .ok_or(ArchiveError::Unsafe("missing staging parent"))?,
    )? < required.saturating_add(DISK_RESERVE)
    {
        return Err(ArchiveError::Unsafe("insufficient disk space"));
    }
    fs::create_dir(staging)?;
    let mut aggregate = 0_u64;
    for entry in approved {
        let mut source = archive.by_index(entry.index)?;
        let output = staging.join(entry.path);
        let parent = output
            .parent()
            .ok_or(ArchiveError::Unsafe("missing parent"))?;
        fs::create_dir_all(parent)?;
        let mut destination = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(output)?;
        copy_bounded(
            &mut source,
            &mut destination,
            entry.declared_size,
            &mut aggregate,
        )?;
        destination.sync_all()?;
    }
    Ok(())
}

pub(super) fn copy_bounded(
    source: &mut impl Read,
    destination: &mut File,
    declared_size: u64,
    aggregate: &mut u64,
) -> Result<(), ArchiveError> {
    let mut buffer = [0_u8; 64 * 1024];
    let mut written = 0_u64;
    loop {
        let length = source.read(&mut buffer)?;
        if length == 0 {
            return Ok(());
        }
        let length =
            u64::try_from(length).map_err(|_| ArchiveError::Unsafe("extraction size limit"))?;
        written = written
            .checked_add(length)
            .ok_or(ArchiveError::Unsafe("extraction size limit"))?;
        *aggregate = aggregate
            .checked_add(length)
            .ok_or(ArchiveError::Unsafe("extraction size limit"))?;
        if written > declared_size || written > MAX_ENTRY_SIZE || *aggregate > MAX_TOTAL_SIZE {
            return Err(ArchiveError::Unsafe("runtime extraction size limit"));
        }
        destination.write_all(
            &buffer[..usize::try_from(length)
                .map_err(|_| ArchiveError::Unsafe("extraction size limit"))?],
        )?;
    }
}
