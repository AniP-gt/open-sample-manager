use super::super::{
    extract_approved_archive, extraction::copy_bounded, ArchiveError, MAX_TOTAL_SIZE,
};
use super::archive;
use std::{
    fs::File,
    io::{Cursor, Write},
};

#[test]
fn rejects_runtime_bytes_exceeding_declared_entry_size() {
    let destination = tempfile::NamedTempFile::new().expect("destination");
    let mut file = File::create(destination.path()).expect("destination file");
    let mut source = Cursor::new(b"12345".to_vec());
    let mut aggregate = 0;
    assert!(matches!(
        copy_bounded(&mut source, &mut file, 4, &mut aggregate),
        Err(ArchiveError::Unsafe("runtime extraction size limit"))
    ));
}

#[test]
fn rejects_runtime_bytes_exceeding_aggregate_limit() {
    let destination = tempfile::NamedTempFile::new().expect("destination");
    let mut file = File::create(destination.path()).expect("destination file");
    let mut source = Cursor::new(b"1".to_vec());
    let mut aggregate = MAX_TOTAL_SIZE;
    assert!(matches!(
        copy_bounded(&mut source, &mut file, 1, &mut aggregate),
        Err(ArchiveError::Unsafe("runtime extraction size limit"))
    ));
}

#[test]
fn rejects_compression_ratio_limit() {
    let input = tempfile::NamedTempFile::new().expect("temp archive");
    let mut writer = zip::ZipWriter::new(File::create(input.path()).expect("archive file"));
    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated);
    writer.start_file("dense.wav", options).expect("entry");
    writer.write_all(b"RIFFxxxxWAVE").expect("header");
    writer.write_all(&vec![0; 16 * 1024]).expect("body");
    writer.finish().expect("finish archive");
    let parent = tempfile::tempdir().expect("dir");
    assert!(matches!(
        extract_approved_archive(input.path(), &parent.path().join("out")),
        Err(ArchiveError::Unsafe("compression ratio limit"))
    ));
}

#[test]
fn rejects_symlink_depth_and_entry_count_limits() {
    let symlink = archive(&[("link.wav", b"RIFFxxxxWAVE")]);
    let mut bytes = std::fs::read(symlink.path()).expect("archive bytes");
    let offset = bytes
        .windows(4)
        .position(|window| window == b"PK\x01\x02")
        .expect("central header")
        + 38;
    bytes[offset..offset + 4].copy_from_slice(&(0o120777_u32 << 16).to_le_bytes());
    std::fs::write(symlink.path(), bytes).expect("patched archive");
    let parent = tempfile::tempdir().expect("dir");
    assert!(matches!(
        extract_approved_archive(symlink.path(), &parent.path().join("symlink")),
        Err(ArchiveError::Unsafe("non-regular or encrypted entry"))
    ));
    let deep = archive(&[("a/b/c/d/e/f/g/h/i/kick.wav", b"RIFFxxxxWAVE")]);
    assert!(matches!(
        extract_approved_archive(deep.path(), &parent.path().join("deep")),
        Err(ArchiveError::Unsafe("path traversal or depth"))
    ));
    let names = (0..5_001)
        .map(|index| (format!("{index}.wav"), b"RIFFxxxxWAVE" as &[u8]))
        .collect::<Vec<_>>();
    let refs = names
        .iter()
        .map(|(name, data)| (name.as_str(), *data))
        .collect::<Vec<_>>();
    let dense = archive(&refs);
    assert!(matches!(
        extract_approved_archive(dense.path(), &parent.path().join("dense")),
        Err(ArchiveError::Unsafe("too many entries"))
    ));
}

#[test]
fn rejects_windows_reserved_archive_components() {
    let input = archive(&[
        ("CON.wav", b"RIFFxxxxWAVE"),
        ("kit/AUX.mid", b"MThd\0\0\0\x06"),
    ]);
    let parent = tempfile::tempdir().expect("dir");
    assert!(matches!(
        extract_approved_archive(input.path(), &parent.path().join("out")),
        Err(ArchiveError::Unsafe("windows reserved path"))
    ));
}

#[test]
fn rejects_windows_ambiguous_archive_components() {
    for name in ["kit./kick.wav", "kit /kick.wav", "kick.wav.", "kick.wav "] {
        let input = archive(&[(name, b"RIFFxxxxWAVE")]);
        let parent = tempfile::tempdir().expect("dir");
        assert!(matches!(
            extract_approved_archive(input.path(), &parent.path().join("out")),
            Err(ArchiveError::Unsafe("windows ambiguous path"))
        ));
    }
}
