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
fn search_prefix_matching() {
    let dir = TempDir::new().unwrap();
    write_wav(&dir, "kick_808.wav", 11_025);
    write_wav(&dir, "kick_909.wav", 11_025);
    write_wav(&dir, "snare.wav", 11_025);

    let manager = make_manager();
    manager.scan_directory(dir.path()).expect("scan failed");

    let results = manager.search("kick*").expect("search failed");
    assert_eq!(results.len(), 2);
}
