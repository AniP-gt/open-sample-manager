use std::fs::File;
use std::io::Write;

use tempfile::TempDir;

use super::super::SampleManager;

pub(super) fn make_manager() -> SampleManager {
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
    buf.extend_from_slice(&list_payload_size.to_le_bytes());
    buf.extend_from_slice(b"INFO");
    buf.extend_from_slice(b"IART");
    buf.extend_from_slice(&iart_size.to_le_bytes());
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

pub(super) fn write_wav_with_artist(
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

pub(super) fn write_wav(dir: &TempDir, name: &str, samples: usize) -> std::path::PathBuf {
    let path = dir.path().join(name);
    let wav_data = build_silence_wav(samples);
    let mut f = File::create(&path).expect("create wav file");
    f.write_all(&wav_data).expect("write wav data");
    path
}

pub(super) fn touch_files(dir: &TempDir, names: &[&str]) {
    for name in names {
        File::create(dir.path().join(name)).expect("create test file");
    }
}
