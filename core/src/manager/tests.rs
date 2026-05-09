use super::audio::extract_artist;
use super::*;
use std::fs::File;
use std::io::Write;
use tempfile::TempDir;

fn make_manager() -> SampleManager {
    SampleManager::new(None).expect("Failed to create in-memory manager")
}

fn build_silence_wav(duration_samples: usize) -> Vec<u8> {
    let sample_rate: u32 = 11_025;
    let num_channels: u16 = 1;
    let bits_per_sample: u16 = 16;
    let block_align = num_channels * bits_per_sample / 8;
    let byte_rate = sample_rate * u32::from(block_align);
    let data_size = (duration_samples * 2) as u32;
    let riff_size = 36 + data_size;

    let mut buf: Vec<u8> = Vec::with_capacity((riff_size + 8) as usize);
    buf.extend_from_slice(b"RIFF");
    buf.extend_from_slice(&riff_size.to_le_bytes());
    buf.extend_from_slice(b"WAVE");
    buf.extend_from_slice(b"fmt ");
    buf.extend_from_slice(&16u32.to_le_bytes());
    buf.extend_from_slice(&1u16.to_le_bytes());
    buf.extend_from_slice(&num_channels.to_le_bytes());
    buf.extend_from_slice(&sample_rate.to_le_bytes());
    buf.extend_from_slice(&byte_rate.to_le_bytes());
    buf.extend_from_slice(&block_align.to_le_bytes());
    buf.extend_from_slice(&bits_per_sample.to_le_bytes());
    buf.extend_from_slice(b"data");
    buf.extend_from_slice(&data_size.to_le_bytes());
    for _ in 0..duration_samples {
        buf.extend_from_slice(&0i16.to_le_bytes());
    }
    buf
}

fn build_wav_with_artist(duration_samples: usize, artist: &str) -> Vec<u8> {
    let sample_rate: u32 = 11_025;
    let num_channels: u16 = 1;
    let bits_per_sample: u16 = 16;
    let block_align = num_channels * bits_per_sample / 8;
    let byte_rate = sample_rate * u32::from(block_align);
    let data_size = (duration_samples * 2) as u32;

    let artist_bytes = artist.as_bytes();
    let artist_len = artist_bytes.len() as u32;
    let iart_size = if (artist_len + 1) % 2 == 0 {
        artist_len + 1
    } else {
        artist_len + 2
    };
    let list_payload_size = 4 + 8 + iart_size;
    let riff_size = 4 + (8 + 16) + (8 + data_size) + (8 + list_payload_size);

    let mut buf: Vec<u8> = Vec::with_capacity((riff_size + 8) as usize);
    buf.extend_from_slice(b"RIFF");
    buf.extend_from_slice(&riff_size.to_le_bytes());
    buf.extend_from_slice(b"WAVE");
    buf.extend_from_slice(b"LIST");
    buf.extend_from_slice(&(list_payload_size as u32).to_le_bytes());
    buf.extend_from_slice(b"INFO");
    buf.extend_from_slice(b"IART");
    buf.extend_from_slice(&(iart_size as u32).to_le_bytes());
    buf.extend_from_slice(artist_bytes);
    buf.push(0u8);
    if (artist_len + 1) % 2 == 1 {
        buf.push(0u8);
    }
    buf.extend_from_slice(b"fmt ");
    buf.extend_from_slice(&16u32.to_le_bytes());
    buf.extend_from_slice(&1u16.to_le_bytes());
    buf.extend_from_slice(&num_channels.to_le_bytes());
    buf.extend_from_slice(&sample_rate.to_le_bytes());
    buf.extend_from_slice(&byte_rate.to_le_bytes());
    buf.extend_from_slice(&block_align.to_le_bytes());
    buf.extend_from_slice(&bits_per_sample.to_le_bytes());
    buf.extend_from_slice(b"data");
    buf.extend_from_slice(&data_size.to_le_bytes());
    for _ in 0..duration_samples {
        buf.extend_from_slice(&0i16.to_le_bytes());
    }
    buf
}

fn write_wav_with_artist(
    dir: &TempDir,
    name: &str,
    samples: usize,
    artist: &str,
) -> std::path::PathBuf {
    let path = dir.path().join(name);
    let wav_data = build_wav_with_artist(samples, artist);
    let mut f = File::create(&path).expect("create wav file");
    f.write_all(&wav_data).expect("write wav data");
    path
}

fn write_wav(dir: &TempDir, name: &str, samples: usize) -> std::path::PathBuf {
    let path = dir.path().join(name);
    let wav_data = build_silence_wav(samples);
    let mut f = File::create(&path).expect("create wav file");
    f.write_all(&wav_data).expect("write wav data");
    path
}

fn touch_files(dir: &TempDir, names: &[&str]) {
    for name in names {
        File::create(dir.path().join(name)).expect("create test file");
    }
}

#[test]
fn new_creates_in_memory_manager() {
    let manager = SampleManager::new(None);
    assert!(manager.is_ok());
}

#[test]
fn new_creates_file_backed_manager() {
    let dir = TempDir::new().unwrap();
    let db_path = dir.path().join("test.db");
    let manager = SampleManager::new(Some(db_path.to_str().unwrap()));
    assert!(manager.is_ok());
}

#[test]
fn scan_directory_discovers_and_stores_samples() {
    let dir = TempDir::new().unwrap();
    write_wav(&dir, "kick.wav", 11_025);
    write_wav(&dir, "snare.wav", 11_025);
    File::create(dir.path().join("readme.txt")).unwrap();

    let manager = make_manager();
    let count = manager.scan_directory(dir.path()).expect("scan failed");
    assert_eq!(count, 2, "should have scanned 2 audio files");
}

#[test]
fn scan_empty_directory_returns_zero() {
    let dir = TempDir::new().unwrap();
    let manager = make_manager();
    let count = manager.scan_directory(dir.path()).expect("scan failed");
    assert_eq!(count, 0);
}

#[test]
fn scan_nonexistent_directory_returns_zero() {
    let manager = make_manager();
    let count = manager
        .scan_directory("/tmp/__definitely_nonexistent_dir__")
        .expect("scan failed");
    assert_eq!(count, 0);
}

#[test]
fn get_sample_after_scan() {
    let dir = TempDir::new().unwrap();
    let wav_path = write_wav(&dir, "kick_808.wav", 11_025);

    let manager = make_manager();
    manager.scan_directory(dir.path()).expect("scan failed");

    let sample = manager
        .get_sample(wav_path.to_str().unwrap())
        .expect("get_sample failed")
        .expect("sample not found");

    assert_eq!(sample.file_name, "kick_808.wav");
    assert!(sample.duration.is_some());
    assert!(sample.bpm.is_some());
    assert!(sample.sample_type.is_some());
}

#[test]
fn get_sample_not_found() {
    let manager = make_manager();
    let result = manager
        .get_sample("/nonexistent/path.wav")
        .expect("get_sample failed");
    assert!(result.is_none());
}

#[test]
fn search_finds_matching_samples() {
    let dir = TempDir::new().unwrap();
    write_wav(&dir, "kick_808.wav", 11_025);
    write_wav(&dir, "snare_tight.wav", 11_025);

    let manager = make_manager();
    manager.scan_directory(dir.path()).expect("scan failed");

    let results = manager.search("kick").expect("search failed");
    assert_eq!(results.len(), 1);
    assert_eq!(results[0].file_name, "kick_808.wav");
}

#[test]
fn search_no_match_returns_empty() {
    let dir = TempDir::new().unwrap();
    write_wav(&dir, "kick.wav", 11_025);

    let manager = make_manager();
    manager.scan_directory(dir.path()).expect("scan failed");

    let results = manager.search("cymbal").expect("search failed");
    assert!(results.is_empty());
}

#[test]
fn analyze_file_returns_metadata() {
    let dir = TempDir::new().unwrap();
    let wav_path = write_wav(&dir, "test_sample.wav", 11_025);

    let manager = make_manager();
    let input = manager.analyze_file(&wav_path).expect("analyze failed");

    assert_eq!(input.file_name, "test_sample.wav");
    assert!(input.duration.is_some());
    assert!(input.bpm.is_some());
    assert!(input.sample_type.is_some());
}

#[test]
fn extract_artist_from_info_list() {
    let dir = TempDir::new().unwrap();
    let wav_path = write_wav_with_artist(&dir, "with_artist.wav", 11_025, "Unit Test Artist");

    let artist = extract_artist(wav_path.as_path());
    assert_eq!(artist, Some("Unit Test Artist".to_string()));
}

#[test]
fn scan_skips_duplicate_paths() {
    let dir = TempDir::new().unwrap();
    write_wav(&dir, "kick.wav", 11_025);

    let manager = make_manager();
    let count1 = manager.scan_directory(dir.path()).expect("scan 1 failed");
    let count2 = manager.scan_directory(dir.path()).expect("scan 2 failed");

    assert_eq!(count1, 1, "first scan should insert 1");
    assert_eq!(count2, 0, "second scan should skip duplicates");
}

#[test]
fn search_fuzzy_subsequence_matching() {
    let dir = TempDir::new().unwrap();
    write_wav(&dir, "kick_808.wav", 11_025);
    write_wav(&dir, "kick_909.wav", 11_025);
    write_wav(&dir, "snare.wav", 11_025);

    let manager = make_manager();
    manager.scan_directory(dir.path()).expect("scan failed");

    let results = manager.search("kc").expect("search failed");
    assert_eq!(results.len(), 2);
}

#[test]
fn manager_instrument_type_crud_roundtrip() {
    let manager = make_manager();

    let id = manager
        .add_instrument_type("phase4-manager-pad")
        .expect("add instrument type failed");
    let inserted = manager
        .get_all_instrument_types()
        .expect("list instrument types failed");
    assert!(inserted
        .iter()
        .any(|row| row.id == id && row.name == "phase4-manager-pad"));

    assert_eq!(
        manager
            .update_instrument_type(id, "phase4-manager-pluck")
            .expect("update instrument type failed"),
        1
    );
    let updated = manager
        .get_all_instrument_types()
        .expect("list updated instrument types failed");
    assert!(updated
        .iter()
        .any(|row| row.id == id && row.name == "phase4-manager-pluck"));

    assert_eq!(
        manager
            .delete_instrument_type(id)
            .expect("delete instrument type failed"),
        1
    );
    let remaining = manager
        .get_all_instrument_types()
        .expect("list remaining instrument types failed");
    assert!(!remaining.iter().any(|row| row.id == id));
}

#[test]
fn manager_update_sample_classification_persists_fields() {
    let dir = TempDir::new().unwrap();
    let wav_path = write_wav(&dir, "classify_me.wav", 11_025);
    let path = wav_path.to_str().expect("utf8 path");
    let manager = make_manager();
    manager.scan_directory(dir.path()).expect("scan failed");

    assert_eq!(
        manager
            .update_sample_classification(
                None,
                Some(path),
                Some("loop".to_string()),
                Some("synth".to_string()),
            )
            .expect("classification update failed"),
        1
    );
    let sample = manager
        .get_sample(path)
        .expect("get sample failed")
        .expect("sample missing");
    assert_eq!(sample.playback_type, "loop");
    assert_eq!(sample.instrument_type, "synth");
    assert_eq!(sample.sample_type.as_deref(), Some("loop"));

    assert_eq!(
        manager
            .update_sample_classification(
                Some(-1),
                None,
                Some("oneshot".to_string()),
                Some("kick".to_string()),
            )
            .expect("missing classification update failed"),
        0
    );
}

#[test]
fn manager_midi_tag_facade_roundtrip() {
    let dir = TempDir::new().unwrap();
    touch_files(&dir, &["tagged.mid"]);
    let midi_path = dir.path().join("tagged.mid");
    let manager = make_manager();
    assert_eq!(
        manager
            .scan_midi_directory(dir.path())
            .expect("midi scan failed"),
        1
    );
    let midi = manager
        .get_midi(midi_path.to_str().expect("utf8 midi path"))
        .expect("get midi failed")
        .expect("midi missing");

    let tag_id = manager
        .add_midi_tag("phase4-manager-midi")
        .expect("add midi tag failed");
    assert!(manager
        .get_all_midi_tags()
        .expect("list midi tags failed")
        .iter()
        .any(|tag| tag.id == tag_id && tag.name == "phase4-manager-midi"));

    manager
        .update_midi_tag(tag_id, "phase4-manager-updated")
        .expect("update midi tag failed");
    manager
        .set_midi_file_tag(midi.id, Some(tag_id))
        .expect("set midi file tag failed");
    let assigned = manager
        .get_midi_file_tags(midi.id)
        .expect("get midi file tags failed");
    assert_eq!(assigned.len(), 1);
    assert_eq!(assigned[0].name, "phase4-manager-updated");
    assert_eq!(
        manager
            .search_midis("updated")
            .expect("search tagged midi failed")
            .len(),
        1
    );

    manager
        .set_midi_file_tag(midi.id, None)
        .expect("remove midi file tag failed");
    assert!(manager
        .get_midi_file_tags(midi.id)
        .expect("get removed midi file tags failed")
        .is_empty());
    assert!(manager
        .search_midis("updated")
        .expect("search removed tag failed")
        .is_empty());
    assert_eq!(
        manager
            .delete_midi_tag(tag_id)
            .expect("delete midi tag failed"),
        1
    );
}

#[test]
fn manager_move_sample_moves_file_and_updates_database() {
    let dir = TempDir::new().unwrap();
    let old_path = write_wav(&dir, "old_move.wav", 11_025);
    let new_path = dir.path().join("new_move.wav");
    let manager = make_manager();
    manager.scan_directory(dir.path()).expect("scan failed");

    let moved = manager
        .move_sample(
            old_path.to_str().expect("utf8 old path"),
            new_path.to_str().expect("utf8 new path"),
        )
        .expect("move sample failed");

    assert_eq!(moved, new_path.to_string_lossy());
    assert!(!old_path.exists());
    assert!(new_path.exists());
    assert!(manager
        .get_sample(old_path.to_str().expect("utf8 old path"))
        .expect("old sample lookup failed")
        .is_none());
    let sample = manager
        .get_sample(new_path.to_str().expect("utf8 new path"))
        .expect("new sample lookup failed")
        .expect("moved sample missing");
    assert_eq!(sample.file_name, "new_move.wav");
}
