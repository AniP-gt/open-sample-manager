# Test Fixtures

Synthetic audio test fixtures for testing audio processing pipelines.

## Files

| File | Duration | Sample Rate | Bit Depth | BPM | Kick Detection | Loop Type | Size |
|------|----------|-------------|-----------|-----|----------------|-----------|------|
| `sine_440hz_1s.wav` | 1.0s | 44100 Hz | 16-bit | N/A | No | One-shot | 86 KB |
| `kick_808.wav` | 0.5s | 44100 Hz | 16-bit | N/A | Yes | One-shot | 43 KB |
| `snare.wav` | 0.2s | 44100 Hz | 16-bit | N/A | No | One-shot | 17 KB |
| `drum_loop_120bpm.wav` | 8.0s | 44100 Hz | 16-bit | ~120 | Mixed | 4-bar loop | 689 KB |

## Description

### sine_440hz_1s.wav
Pure sine wave at 440 Hz (musical note A4). Used for basic frequency analysis and simple signal processing tests.

**Expected behavior**: Should detect as a steady tone with fundamental frequency at 440 Hz.

### kick_808.wav
Synthetic kick drum with frequency sweep and exponential decay, mimicking the classic 808 drum machine kick.
- Frequency sweep: 150 Hz → 40 Hz
- Decay time: ~0.5 seconds
- Envelope: Exponential with -3.0 dB/time decay

**Expected behavior**: Kick detection should identify this as a low-frequency percussive element.

### snare.wav
Synthetic snare drum using white noise with quick attack and exponential decay.
- Duration: 0.2 seconds
- Attack: 0.1s sharp attack
- Decay: Exponential fall-off (Q-factor ~5)

**Expected behavior**: Should classify as transient percussion, not a kick.

### drum_loop_120bpm.wav
4-bar drum pattern at 120 BPM combining kicks and snares:
- Kick on beats 1 and 3 of each bar
- Snare on beats 2 and 4 of each bar
- Total duration: 8 seconds (4 bars × 4 beats)

**Expected behavior**: 
- BPM detection should identify ~120 BPM
- Kick detection should recognize 2 kicks per bar
- Loop detection should classify as periodic 4-bar pattern

## Generation

Fixtures generated using Rust with manual WAV header writing. All samples are 16-bit signed integers, mono, 44100 Hz sample rate.

Generation code: `core/generate_test_fixtures.rs`
