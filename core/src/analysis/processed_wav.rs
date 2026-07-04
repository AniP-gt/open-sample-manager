use std::path::Path;

use serde::{Deserialize, Serialize};
use thiserror::Error;

use super::decoder::{decode_to_interleaved_f32, DecodeError};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub struct ProcessedSampleRenderSeconds {
    pub trim_start_seconds: f32,
    pub trim_end_seconds: Option<f32>,
    pub fade_in_seconds: f32,
    pub fade_out_seconds: f32,
    pub gain_db: f32,
}

impl Default for ProcessedSampleRenderSeconds {
    fn default() -> Self {
        Self {
            trim_start_seconds: 0.0,
            trim_end_seconds: None,
            fade_in_seconds: 0.0,
            fade_out_seconds: 0.0,
            gain_db: 0.0,
        }
    }
}

#[derive(Debug, Error)]
pub enum ProcessedWavError {
    #[error("decode error: {0}")]
    Decode(#[from] DecodeError),
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
    #[error("WAV write error: {0}")]
    Wav(#[from] hound::Error),
    #[error("invalid processing parameters: {0}")]
    InvalidParams(String),
}

pub fn render_processed_wav(
    source_path: &Path,
    output_path: &Path,
    params: ProcessedSampleRenderSeconds,
) -> Result<(), ProcessedWavError> {
    validate_params(params)?;

    let decoded = decode_to_interleaved_f32(source_path)?;
    let trimmed = trim_frames(
        &decoded.samples,
        decoded.sample_rate,
        decoded.channels,
        params,
    )?;
    let processed =
        apply_envelope_and_gain(&trimmed, decoded.sample_rate, decoded.channels, params);

    if let Some(parent) = output_path.parent() {
        std::fs::create_dir_all(parent)?;
    }

    write_pcm16_wav(
        output_path,
        decoded.sample_rate,
        decoded.channels,
        &processed,
    )?;
    Ok(())
}

pub fn validate_params(params: ProcessedSampleRenderSeconds) -> Result<(), ProcessedWavError> {
    validate_non_negative("trim_start_seconds", params.trim_start_seconds)?;
    validate_non_negative("fade_in_seconds", params.fade_in_seconds)?;
    validate_non_negative("fade_out_seconds", params.fade_out_seconds)?;
    if !params.gain_db.is_finite() {
        return Err(ProcessedWavError::InvalidParams(
            "gain_db must be finite".to_string(),
        ));
    }
    if let Some(trim_end_seconds) = params.trim_end_seconds {
        validate_non_negative("trim_end_seconds", trim_end_seconds)?;
        if trim_end_seconds < params.trim_start_seconds {
            return Err(ProcessedWavError::InvalidParams(
                "trim_end_seconds must be greater than or equal to trim_start_seconds".to_string(),
            ));
        }
    }
    Ok(())
}

fn validate_non_negative(name: &str, value: f32) -> Result<(), ProcessedWavError> {
    if value.is_finite() && value >= 0.0 {
        return Ok(());
    }

    Err(ProcessedWavError::InvalidParams(format!(
        "{name} must be finite and non-negative"
    )))
}

#[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
fn trim_frames(
    samples: &[f32],
    sample_rate: u32,
    channels: usize,
    params: ProcessedSampleRenderSeconds,
) -> Result<Vec<f32>, ProcessedWavError> {
    let frame_count = samples.len() / channels;
    let start = seconds_to_index(params.trim_start_seconds, sample_rate).min(frame_count);
    let end = params
        .trim_end_seconds
        .map(|seconds| seconds_to_index(seconds, sample_rate).min(frame_count))
        .unwrap_or(frame_count);

    if start > end {
        return Err(ProcessedWavError::InvalidParams(
            "trim range is outside the decoded sample bounds".to_string(),
        ));
    }

    Ok(samples[start * channels..end * channels].to_vec())
}

#[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
fn seconds_to_index(seconds: f32, sample_rate: u32) -> usize {
    (seconds * sample_rate as f32).round() as usize
}

fn apply_envelope_and_gain(
    samples: &[f32],
    sample_rate: u32,
    channels: usize,
    params: ProcessedSampleRenderSeconds,
) -> Vec<f32> {
    let gain = 10.0_f32.powf(params.gain_db / 20.0);
    let frame_count = samples.len() / channels;
    let fade_in_len = seconds_to_index(params.fade_in_seconds, sample_rate).min(frame_count);
    let fade_out_len = seconds_to_index(params.fade_out_seconds, sample_rate).min(frame_count);

    samples
        .chunks_exact(channels)
        .enumerate()
        .flat_map(|(frame_index, frame)| {
            let fade_in = if fade_in_len == 0 {
                1.0
            } else {
                frame_index as f32 / fade_in_len as f32
            };
            let fade_out = if fade_out_len == 0 {
                1.0
            } else {
                (frame_count - frame_index - 1) as f32 / fade_out_len as f32
            };
            let scale = gain * fade_in.min(1.0).min(fade_out.min(1.0));
            frame
                .iter()
                .map(move |sample| (sample * scale).clamp(-1.0, 1.0))
        })
        .collect()
}

fn write_pcm16_wav(
    path: &Path,
    sample_rate: u32,
    channels: usize,
    samples: &[f32],
) -> Result<(), ProcessedWavError> {
    let channels = u16::try_from(channels).map_err(|_| {
        ProcessedWavError::InvalidParams("channel count exceeds WAV writer limits".to_string())
    })?;
    let spec = hound::WavSpec {
        channels,
        sample_rate,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };
    let file = std::fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)?;
    let mut writer = hound::WavWriter::new(file, spec)?;
    for sample in samples {
        writer.write_sample(float_to_pcm16(*sample))?;
    }
    writer.finalize()?;
    Ok(())
}

fn float_to_pcm16(sample: f32) -> i16 {
    let clamped = sample.clamp(-1.0, 1.0);
    if clamped <= -1.0 {
        i16::MIN
    } else {
        (clamped * i16::MAX as f32).round() as i16
    }
}
