use super::{
    download::sanitize_preview_filename, write_preview_download, FreesoundApiKey,
    PreviewDownloadError,
};

#[test]
fn api_key_accepts_trimmed_ascii_alphanumeric_value_at_minimum_length() {
    // Given: an API key with incidental surrounding whitespace.
    let raw = format!("  {}  ", "a".repeat(16));

    // When: the renderer value crosses the credential boundary.
    let key = FreesoundApiKey::parse(&raw);

    // Then: the secret is accepted without preserving whitespace.
    assert!(key.is_ok());
}

#[test]
fn api_key_rejects_non_alphanumeric_or_out_of_range_value() {
    // Given: malformed and boundary-invalid API keys.
    let cases = ["a".repeat(15), "a-b".repeat(6), "a".repeat(513)];

    // When / Then: each value is parsed at the credential boundary.
    for raw in cases {
        assert!(FreesoundApiKey::parse(&raw).is_err());
    }
}

#[test]
fn preview_download_filename_is_sanitized_and_forced_to_mp3() {
    // Given: a search result name containing traversal syntax and a foreign extension.
    let name = "../Kick: 01.wav";

    // When: a filename is derived for a downloaded preview.
    let filename = sanitize_preview_filename(name);

    // Then: it cannot escape the destination and identifies an MP3 preview.
    assert_eq!(filename, "Kick_ 01.mp3");
}

#[test]
fn preview_download_rejects_an_existing_destination_without_overwriting() {
    // Given: a destination with the safe output name already present.
    let directory = tempfile::tempdir().expect("directory");
    let existing = directory.path().join("Kick.mp3");
    std::fs::write(&existing, b"existing").expect("existing preview");

    // When: another preview attempts to use that same name.
    let result = write_preview_download(directory.path(), "Kick", b"replacement");

    // Then: the conflict is reported and the existing file remains unchanged.
    assert!(matches!(
        result,
        Err(PreviewDownloadError::DestinationExists)
    ));
    assert_eq!(
        std::fs::read(existing).expect("existing content"),
        b"existing"
    );
}

#[test]
fn preview_download_rejects_a_file_as_the_destination() {
    // Given: a file instead of a user-selected directory.
    let parent = tempfile::tempdir().expect("parent");
    let destination = parent.path().join("not-a-directory");
    std::fs::write(&destination, b"x").expect("destination file");

    // When: the preview write is prepared.
    let result = write_preview_download(&destination, "Kick", b"preview");

    // Then: the invalid destination receives a stable typed error.
    assert!(matches!(
        result,
        Err(PreviewDownloadError::InvalidDestination)
    ));
}

#[test]
fn preview_download_writes_a_new_mp3_in_the_selected_directory() {
    // Given: an empty user-selected destination and downloaded preview bytes.
    let directory = tempfile::tempdir().expect("directory");

    // When: the preview is promoted into the destination.
    let path = write_preview_download(directory.path(), "Kick.wav", b"preview")
        .expect("downloaded preview");

    // Then: the result is a new MP3 file containing the downloaded bytes.
    assert_eq!(path, directory.path().join("Kick.mp3"));
    assert_eq!(std::fs::read(path).expect("preview content"), b"preview");
}
