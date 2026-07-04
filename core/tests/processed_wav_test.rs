use std::path::Path;

use open_sample_manager_core::analysis::processed_wav::{
    render_processed_wav, validate_params, ProcessedSampleRenderSeconds, ProcessedWavError,
};

#[test]
fn validation_rejects_negative_trim_start() {
    let params = ProcessedSampleRenderSeconds {
        trim_start_seconds: -0.1,
        ..ProcessedSampleRenderSeconds::default()
    };

    assert!(matches!(
        validate_params(params),
        Err(ProcessedWavError::InvalidParams(_))
    ));
}

#[test]
fn validation_rejects_trim_end_before_start() {
    let params = ProcessedSampleRenderSeconds {
        trim_start_seconds: 2.0,
        trim_end_seconds: Some(1.0),
        ..ProcessedSampleRenderSeconds::default()
    };

    assert!(matches!(
        validate_params(params),
        Err(ProcessedWavError::InvalidParams(_))
    ));
}

#[test]
fn renderer_trims_fades_gains_clamps_and_writes_pcm() {
    let dir = tempfile::tempdir().unwrap();
    let source = dir.path().join("source.wav");
    let output = dir.path().join("processed.wav");
    let frames = 44_100usize;
    let mut samples = Vec::with_capacity(frames * 2);
    for _ in 0..frames {
        samples.push(0.5);
        samples.push(-0.25);
    }
    write_fixture_wav(&source, 44_100, 2, &samples);

    render_processed_wav(
        &source,
        &output,
        ProcessedSampleRenderSeconds {
            trim_start_seconds: 0.25,
            trim_end_seconds: Some(0.75),
            fade_in_seconds: 0.05,
            fade_out_seconds: 0.05,
            gain_db: 12.0,
        },
    )
    .unwrap();

    let mut reader = hound::WavReader::open(output).unwrap();
    let spec = reader.spec();
    let samples: Vec<i16> = reader.samples::<i16>().map(Result::unwrap).collect();

    assert_eq!(spec.channels, 2);
    assert_eq!(spec.sample_rate, 44_100);
    assert_eq!(spec.bits_per_sample, 16);
    assert_eq!(spec.sample_format, hound::SampleFormat::Int);
    assert_eq!(samples.len(), 44_100);
    assert_eq!(samples[0], 0);
    assert_eq!(samples[1], 0);
    assert_eq!(samples[samples.len() - 2], 0);
    assert_eq!(samples[samples.len() - 1], 0);
    let mid_frame = samples.len() / 4;
    assert_eq!(samples[mid_frame * 2], i16::MAX);
    assert!(samples[mid_frame * 2 + 1] < -32_000);
}

fn write_fixture_wav(path: &Path, sample_rate: u32, channels: u16, samples: &[f32]) {
    let spec = hound::WavSpec {
        channels,
        sample_rate,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };
    let mut writer = hound::WavWriter::create(path, spec).unwrap();
    for sample in samples {
        writer.write_sample(float_to_pcm16(*sample)).unwrap();
    }
    writer.finalize().unwrap();
}

fn float_to_pcm16(sample: f32) -> i16 {
    let clamped = sample.clamp(-1.0, 1.0);
    if clamped <= -1.0 {
        i16::MIN
    } else {
        (clamped * i16::MAX as f32).round() as i16
    }
}
