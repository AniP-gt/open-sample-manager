# ANALYSIS MODULE

**Generated:** 2026-05-09T22:22:11+0900
**Commit:** a14778f

## OVERVIEW
DSP and MIDI parsing pipeline: decode audio to mono f32, compute spectral/onset features, classify sample type/instrument/key, and parse MIDI metadata.

## WHERE TO LOOK
| Task | Location | Notes |
|---|---|---|
| Public analysis types | `mod.rs` | `AnalysisResult`; re-exports modules |
| Audio decode | `decoder.rs` | symphonia-backed decode to mono f32, target rate 11025 |
| FFT/STFT | `fft_utils.rs` | `FftProcessor`, Hann window, STFT helpers |
| Onsets | `onset.rs` | Spectral flux normalization + peak detection |
| BPM | `bpm.rs` | Onset interval estimation, 60-200 BPM range |
| Kick detection | `kick.rs` | Low-band ratio, attack slope, decay time |
| Loop classification | `loop_classifier.rs` | Duration + periodicity + energy ratio gate |
| Instrument/sample classification | `classifier.rs` | Playback/instrument enums and combined classifier |
| Key detection | `key.rs` | Pitch-class heuristic for audio samples |
| MIDI parse | `midi.rs` | midly parsing, tempo map, time signature, key estimate |

## CONVENTIONS
- Public audio functions take `&[f32]` plus `sample_rate: u32`; keep raw byte decoding in `decoder.rs`.
- Use `Result<T, AnalysisError/DecodeError>` at boundaries; panics are not acceptable in production paths.
- Cast precision suppressions are expected only where DSP math requires them.
- Keep hot-path buffers f32; do not introduce f64 sample buffers.
- MIDI parsing is independent from audio decoding and returns partial metadata for unsupported SMPTE timing.

## ANTI-PATTERNS
- Do not call symphonia outside `decoder.rs`.
- Do not widen `#[allow(...)]` without a DSP-specific reason.
- Do not make classifier changes without checking DB classification defaults and UI normalization.
- `decoder.rs` has a known `sample_rate.unwrap()` panic path; do not copy that pattern.

## NOTES
- `manager/analyze.rs` combines analysis output into `SampleInput`, including waveform peaks, embeddings, playback type, instrument type, and musical key.
- Unit tests are embedded in most analysis modules; integration fixture tests live in `core/tests/integration_test.rs`.
