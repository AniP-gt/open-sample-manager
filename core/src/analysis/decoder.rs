use std::fs::File;

use std::path::Path;

use symphonia::core::audio::SampleBuffer;
use symphonia::core::codecs::DecoderOptions;
use symphonia::core::errors::Error as SymphoniaError;
use symphonia::core::io::MediaSourceStream;
use symphonia::default::{get_codecs, get_probe};
use thiserror::Error;

/// Target sample rate for all decoded audio.
pub const TARGET_SAMPLE_RATE: u32 = 11_025;

/// Decoded audio data after monaural conversion and downsampling.
#[derive(Debug, Clone)]
pub struct DecodedAudio {
    /// Mono samples at `sample_rate` Hz in the range [-1.0, 1.0].
    pub samples: Vec<f32>,
    /// The actual sample rate of the decoded data (typically [`TARGET_SAMPLE_RATE`]).
    pub sample_rate: u32,
}

/// Errors that can occur during audio decoding.
#[derive(Debug, Error)]
pub enum DecodeError {
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Symphonia error: {0}")]
    Symphonia(#[from] SymphoniaError),

    #[error("No audio tracks found in file")]
    NoAudioTrack,

    #[error("Could not create decoder for track")]
    DecoderCreation,
}

/// Decode an audio file to a mono f32 sample buffer downsampled to `TARGET_SAMPLE_RATE`.
///
/// Steps:
/// 1. Open file and probe its format via symphonia.
/// 2. Find the first audio track with a known sample rate.
/// 3. Decode all packets, converting to interleaved f32 samples.
/// 4. Convert to mono by averaging all channels.
/// 5. Downsample to `TARGET_SAMPLE_RATE` using simple decimation.
pub fn decode_to_mono_f32(path: &Path) -> Result<DecodedAudio, DecodeError> {
    let file = File::open(path)?;
    let mss = MediaSourceStream::new(Box::new(file), Default::default());

    let probed = get_probe().format(
        &Default::default(),
        mss,
        &Default::default(),
        &Default::default(),
    )?;

    let mut format = probed.format;

    // Find first audio track with a sample rate.
    let track = format
        .tracks()
        .iter()
        .find(|t| t.codec_params.sample_rate.is_some())
        .ok_or(DecodeError::NoAudioTrack)?;

    let original_sample_rate = track.codec_params.sample_rate.unwrap();
    let track_id = track.id;

    let mut decoder = get_codecs()
        .make(&track.codec_params, &DecoderOptions::default())
        .map_err(|_| DecodeError::DecoderCreation)?;

    // Collect all interleaved f32 samples from every packet.
    let mut all_interleaved: Vec<f32> = Vec::new();
    let mut num_channels: usize = 0;

    loop {
        let pkt = match format.next_packet() {
            Ok(p) => p,
            Err(SymphoniaError::IoError(_)) => break,
            Err(SymphoniaError::ResetRequired) => {
                // Some formats signal a stream reset; just continue.
                continue;
            }
            Err(e) => return Err(DecodeError::Symphonia(e)),
        };

        // Only process packets for the selected track.
        if pkt.track_id() != track_id {
            continue;
        }

        let decoded = match decoder.decode(&pkt) {
            Ok(d) => d,
            Err(SymphoniaError::IoError(_)) | Err(SymphoniaError::DecodeError(_)) => {
                // Non-fatal decode errors: skip this packet.
                continue;
            }
            Err(e) => return Err(DecodeError::Symphonia(e)),
        };

        let spec = *decoded.spec();
        let channels = spec.channels.count();

        if channels > 0 && num_channels == 0 {
            num_channels = channels;
        }

        let mut sample_buf = SampleBuffer::<f32>::new(decoded.capacity() as u64, spec);
        sample_buf.copy_interleaved_ref(decoded);
        all_interleaved.extend_from_slice(sample_buf.samples());
    }

    if num_channels == 0 {
        // Treat as mono if we never encountered a non-zero channel count.
        num_channels = 1;
    }

    // Convert interleaved multi-channel samples to mono.
    let mono = interleaved_to_mono(&all_interleaved, num_channels);

    // Downsample to target rate via simple decimation.
    let decimation_factor = decimation_ratio(original_sample_rate, TARGET_SAMPLE_RATE);
    let downsampled = decimate(&mono, decimation_factor);

    Ok(DecodedAudio {
        samples: downsampled,
        sample_rate: TARGET_SAMPLE_RATE,
    })
}

/// Average interleaved multi-channel samples into a single mono channel.
///
/// `num_channels` must be >= 1. If samples is empty, returns an empty vec.
fn interleaved_to_mono(interleaved: &[f32], num_channels: usize) -> Vec<f32> {
    if num_channels <= 1 || interleaved.is_empty() {
        return interleaved.to_vec();
    }

    let frame_count = interleaved.len() / num_channels;
    let inv = 1.0 / num_channels as f32;

    (0..frame_count)
        .map(|i| {
            let base = i * num_channels;
            interleaved[base..base + num_channels].iter().sum::<f32>() * inv
        })
        .collect()
}

/// Compute integer decimation ratio: round(original / target), at least 1.
fn decimation_ratio(original: u32, target: u32) -> usize {
    let ratio = (original as f64 / target as f64).round() as usize;
    ratio.max(1)
}

/// Simple decimation: keep every `ratio`-th sample starting at index 0.
fn decimate(samples: &[f32], ratio: usize) -> Vec<f32> {
    if ratio <= 1 {
        return samples.to_vec();
    }
    samples.iter().step_by(ratio).copied().collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::f32::consts::PI;

    #[test]
    fn interleaved_mono_passthrough() {
        let mono = vec![0.1, 0.2, 0.3];
        let result = interleaved_to_mono(&mono, 1);
        assert_eq!(result, mono);
    }

    #[test]
    fn interleaved_stereo_averages_channels() {
        // L=1.0, R=-1.0 → average 0.0
        let stereo = vec![1.0_f32, -1.0, 0.5, 0.5];
        let result = interleaved_to_mono(&stereo, 2);
        assert_eq!(result.len(), 2);
        assert!((result[0]).abs() < 1e-6, "Expected 0.0, got {}", result[0]);
        assert!(
            (result[1] - 0.5).abs() < 1e-6,
            "Expected 0.5, got {}",
            result[1]
        );
    }

    #[test]
    fn interleaved_three_channel_averages_correctly() {
        // Three channels: 3.0, 6.0, 9.0 → average 6.0
        let samples = vec![3.0_f32, 6.0, 9.0];
        let result = interleaved_to_mono(&samples, 3);
        assert_eq!(result.len(), 1);
        assert!(
            (result[0] - 6.0).abs() < 1e-5,
            "Expected 6.0, got {}",
            result[0]
        );
    }

    #[test]
    fn interleaved_to_mono_empty_input() {
        let result = interleaved_to_mono(&[], 2);
        assert!(result.is_empty());
    }

    #[test]
    fn decimation_ratio_exact() {
        // 44100 / 11025 = 4.0 exactly
        assert_eq!(decimation_ratio(44_100, 11_025), 4);
    }

    #[test]
    fn decimation_ratio_rounding() {
        // 48000 / 11025 ≈ 4.354 → rounds to 4
        assert_eq!(decimation_ratio(48_000, 11_025), 4);
    }

    #[test]
    fn decimation_ratio_minimum_one() {
        // If original < target, ratio should be at least 1.
        assert_eq!(decimation_ratio(8_000, 11_025), 1);
    }

    #[test]
    fn decimate_ratio_one_passthrough() {
        let samples = vec![1.0, 2.0, 3.0, 4.0];
        let result = decimate(&samples, 1);
        assert_eq!(result, samples);
    }

    #[test]
    fn decimate_keeps_every_nth_sample() {
        let samples: Vec<f32> = (0..8).map(|i| i as f32).collect();
        let result = decimate(&samples, 2);
        // Indices 0, 2, 4, 6
        assert_eq!(result, vec![0.0, 2.0, 4.0, 6.0]);
    }

    #[test]
    fn decimate_ratio_four() {
        let samples: Vec<f32> = (0..16).map(|i| i as f32).collect();
        let result = decimate(&samples, 4);
        assert_eq!(result, vec![0.0, 4.0, 8.0, 12.0]);
    }

    fn build_wav(num_channels: u16, sample_rate: u32, samples: &[i16]) -> Vec<u8> {
        let bits_per_sample: u16 = 16;
        let block_align = num_channels * bits_per_sample / 8;
        let byte_rate = sample_rate * u32::from(block_align);
        let data_size = (samples.len() * 2) as u32; // i16 = 2 bytes
        let riff_size = 36 + data_size;

        let mut buf: Vec<u8> = Vec::with_capacity((riff_size + 8) as usize);

        // RIFF header
        buf.extend_from_slice(b"RIFF");
        buf.extend_from_slice(&riff_size.to_le_bytes());
        buf.extend_from_slice(b"WAVE");

        // fmt  chunk
        buf.extend_from_slice(b"fmt ");
        buf.extend_from_slice(&16u32.to_le_bytes()); // chunk size
        buf.extend_from_slice(&1u16.to_le_bytes()); // PCM
        buf.extend_from_slice(&num_channels.to_le_bytes());
        buf.extend_from_slice(&sample_rate.to_le_bytes());
        buf.extend_from_slice(&byte_rate.to_le_bytes());
        buf.extend_from_slice(&block_align.to_le_bytes());
        buf.extend_from_slice(&bits_per_sample.to_le_bytes());

        // data chunk
        buf.extend_from_slice(b"data");
        buf.extend_from_slice(&data_size.to_le_bytes());
        for s in samples {
            buf.extend_from_slice(&s.to_le_bytes());
        }

        buf
    }

    fn decode_wav_bytes(wav_bytes: &[u8]) -> DecodedAudio {
        use std::io::Write;
        let mut tmp = tempfile::NamedTempFile::new().expect("tempfile");
        tmp.write_all(wav_bytes).expect("write wav");
        tmp.flush().expect("flush");
        decode_to_mono_f32(tmp.path()).expect("decode")
    }

    #[test]
    fn decode_mono_wav_passthrough() {
        // 44100 Hz mono, 44100 samples of silence.
        let samples: Vec<i16> = vec![0i16; 44_100];
        let wav = build_wav(1, 44_100, &samples);
        let audio = decode_wav_bytes(&wav);

        assert_eq!(audio.sample_rate, TARGET_SAMPLE_RATE);
        // 44100 samples / ratio 4 = 11025 samples
        assert_eq!(audio.samples.len(), 11_025);
        // All silence → all zeros
        for s in &audio.samples {
            assert!(s.abs() < 1e-5, "Expected silence, got {}", s);
        }
    }

    #[test]
    fn decode_stereo_wav_converts_to_mono() {
        // 44100 Hz stereo: left=max positive, right=max negative → average ≈ 0
        let frame_count = 44_100usize;
        let i16_max = i16::MAX;
        let i16_min = i16::MIN;
        let mut samples = Vec::with_capacity(frame_count * 2);
        for _ in 0..frame_count {
            samples.push(i16_max);
            samples.push(i16_min);
        }
        let wav = build_wav(2, 44_100, &samples);
        let audio = decode_wav_bytes(&wav);

        assert_eq!(audio.sample_rate, TARGET_SAMPLE_RATE);
        // Each mono sample should be close to zero.
        for (i, s) in audio.samples.iter().enumerate() {
            assert!(s.abs() < 0.01, "Sample {i} expected ~0.0, got {}", s);
        }
    }

    #[test]
    fn decode_produces_correct_sample_rate() {
        // Confirm the returned sample_rate is always TARGET_SAMPLE_RATE.
        let samples: Vec<i16> = vec![0i16; 22_050];
        let wav = build_wav(1, 22_050, &samples);
        let audio = decode_wav_bytes(&wav);
        assert_eq!(audio.sample_rate, TARGET_SAMPLE_RATE);
    }

    #[test]
    fn decode_sine_wave_preserves_amplitude() {
        // 440 Hz sine at 44100 Hz, mono.  After decimation values should still
        // be in [-1, 1] and non-trivially non-zero.
        let sr = 44_100u32;
        let freq = 440.0_f32;
        let samples: Vec<i16> = (0..sr)
            .map(|n| {
                let t = n as f32 / sr as f32;
                let v = (2.0 * PI * freq * t).sin();
                (v * i16::MAX as f32) as i16
            })
            .collect();
        let wav = build_wav(1, sr, &samples);
        let audio = decode_wav_bytes(&wav);

        assert!(!audio.samples.is_empty());
        let max_amp = audio.samples.iter().cloned().fold(0.0_f32, f32::max);
        // The peak should be close to 1.0 (i16::MAX normalised).
        assert!(max_amp > 0.9, "Peak amplitude too low: {}", max_amp);
        assert!(
            max_amp <= 1.0 + 1e-4,
            "Peak amplitude out of range: {}",
            max_amp
        );
    }
}
