# ANALYSIS MODULE

**Generated:** 2026-03-03T06:50:00+0900
**Commit:** 68204da

## OVERVIEW
DSP pipeline: decode audio → onset detection → FFT → BPM/kick/loop classification. Also decodes MIDI metadata.

## WHERE TO LOOK
| Task | Location | Notes |
|---|---|---|
| Pipeline entry | `mod.rs` | Re-exports all analysis types; start here |
| Audio decode | `decoder.rs` | symphonia-backed; decodes to f32 samples |
| Onset detection | `onset.rs` | Energy-based onset frames |
| FFT utilities | `fft_utils.rs` | Shared FFT helpers (windowing, magnitude) |
| BPM estimation | `bpm.rs` | Onset-to-beat-interval → BPM |
| Kick detection | `kick.rs` | Low-freq energy burst classifier |
| Loop classification | `loop_classifier.rs` | Compares start/end spectral similarity |
| Sample classifier | `classifier.rs` | Combines kick/loop/onset → playbackType |
| MIDI decode | `midi.rs` | Reads MIDI file → track count, tempo, key |

## CONVENTIONS
- All analysis functions take `&[f32]` samples + `sample_rate: u32` — never raw bytes.
- DSP cast suppressions (`#[allow(clippy::cast_precision_loss)]`) are expected throughout; do not remove.
- Return `Result<T, AnalysisError>` in public functions; panic is not acceptable in production paths.
- `decoder.rs` currently panics on missing sample_rate — known gap, do not widen this pattern.

## ANTI-PATTERNS
- Do not add new `#[allow()]` suppressions without DSP justification.
- Do not call symphonia APIs outside `decoder.rs`; centralize decoding there.
- Do not introduce f64 intermediate buffers in hot paths — DSP stays f32.

## NOTES
- `classifier.rs` aggregates results from kick, loop, onset — changes there ripple into DB classification fields.
- MIDI decode in `midi.rs` is separate pipeline from audio decode; no shared state.
