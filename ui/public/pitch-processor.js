// Phase vocoder pitch shifter — shifts pitch without affecting tempo.
//
// Algorithm: STFT analysis -> phase manipulation -> bin remapping -> ISTFT.
// Uses Cooley-Tukey radix-2 FFT (O(N log N)) so it stays well under the
// real-time budget at the chosen FFT size. Hann window with 75% overlap
// (hop = FFT_SIZE / 4).
//
// Communication: the host posts `{ pitchFactor }` via the worklet port.
// pitchFactor === 1.0 short-circuits the FFT pipeline and passes audio
// straight through.

const FFT_SIZE = 512;
const HOP_SIZE = 128;
const OVERLAP = FFT_SIZE / HOP_SIZE; // 4
const HALF = FFT_SIZE / 2;

// In-place radix-2 FFT (Cooley-Tukey). Mutates `re` and `im`.
function fft(re, im) {
  const N = re.length;

  // Bit-reversal permutation.
  for (let i = 1, j = 0; i < N; i++) {
    let bit = N >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i]; re[i] = re[j]; re[j] = tr;
      const ti = im[i]; im[i] = im[j]; im[j] = ti;
    }
  }

  for (let len = 2; len <= N; len <<= 1) {
    const half = len >> 1;
    const ang = -2 * Math.PI / len;
    const wRe = Math.cos(ang);
    const wIm = Math.sin(ang);
    for (let i = 0; i < N; i += len) {
      let curRe = 1;
      let curIm = 0;
      for (let j = 0; j < half; j++) {
        const idxA = i + j;
        const idxB = idxA + half;
        const aRe = re[idxA];
        const aIm = im[idxA];
        const bRe = re[idxB] * curRe - im[idxB] * curIm;
        const bIm = re[idxB] * curIm + im[idxB] * curRe;
        re[idxA] = aRe + bRe;
        im[idxA] = aIm + bIm;
        re[idxB] = aRe - bRe;
        im[idxB] = aIm - bIm;
        const nextRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
      }
    }
  }
}

// Inverse FFT via the conjugate trick.
function ifft(re, im) {
  const N = re.length;
  for (let i = 0; i < N; i++) im[i] = -im[i];
  fft(re, im);
  const inv = 1 / N;
  for (let i = 0; i < N; i++) {
    re[i] *= inv;
    im[i] = -im[i] * inv;
  }
}

// Wrap a phase value into the (-PI, PI] range.
function wrapPhase(phase) {
  return phase - 2 * Math.PI * Math.round(phase / (2 * Math.PI));
}

class PitchProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    this._pitchFactor = 1.0;

    // Hann analysis/synthesis window.
    this._window = new Float32Array(FFT_SIZE);
    for (let i = 0; i < FFT_SIZE; i++) {
      this._window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / FFT_SIZE));
    }

    // Per-channel state, lazily resized when the channel count is observed.
    this._state = [];

    this.port.onmessage = (e) => {
      const data = e.data;
      if (data && typeof data.pitchFactor === 'number' && Number.isFinite(data.pitchFactor)) {
        this._pitchFactor = Math.max(0.5, Math.min(2.0, data.pitchFactor));
      }
    };
  }

  _ensureChannels(n) {
    while (this._state.length < n) {
      this._state.push({
        // Sliding window of the last FFT_SIZE input samples.
        inBuffer: new Float32Array(FFT_SIZE),
        // Synthesis ring buffer; sized for FFT_SIZE * 3 to accommodate
        // overlap-add headroom across hops without wraparound corruption.
        outBuffer: new Float32Array(FFT_SIZE * 3),
        // Frame scratch (FFT input/output in the frequency domain).
        re: new Float32Array(FFT_SIZE),
        im: new Float32Array(FFT_SIZE),
        // Last analysis phase, indexed by bin (only first HALF+1 bins used).
        lastAnaPhase: new Float32Array(HALF + 1),
        // Accumulated synthesis phase, indexed by bin.
        sumPhase: new Float32Array(HALF + 1),
        // Pre-allocated bin-remap scratch buffers (avoid per-frame allocation
        // on the audio thread).
        newMag: new Float32Array(HALF + 1),
        newFreq: new Float32Array(HALF + 1),
        // Sample counter; once it reaches HOP_SIZE we run a vocoder frame.
        hopCounter: 0,
        // Read offset into outBuffer (head of the synthesis stream).
        outReadPos: 0,
        // Number of unread samples currently in outBuffer.
        outAvailable: 0,
        // Tracks whether the previous block was passthrough; lets us reset
        // accumulator state only on the first passthrough block after use.
        wasPassthrough: true,
      });
    }
  }

  // Process one analysis frame: read FFT_SIZE samples from inBuffer, perform
  // pitch shift via bin remapping with phase accumulation, overlap-add the
  // result into outBuffer.
  _processFrame(state, pitchFactor) {
    const inBuffer = state.inBuffer;
    const outBuffer = state.outBuffer;
    const re = state.re;
    const im = state.im;
    const lastAnaPhase = state.lastAnaPhase;
    const sumPhase = state.sumPhase;
    const win = this._window;

    // Windowed analysis: copy & window inBuffer into re, zero im.
    for (let i = 0; i < FFT_SIZE; i++) {
      re[i] = inBuffer[i] * win[i];
      im[i] = 0;
    }

    fft(re, im);

    // Magnitude / true-frequency analysis on the lower half-spectrum.
    // The vocoder remaps bin k -> bin round(k * pitchFactor) and accumulates
    // the synthesis phase using the analysis frequency, scaled by pitchFactor.
    const expected = (2 * Math.PI * HOP_SIZE) / FFT_SIZE;

    const newMag = state.newMag;
    const newFreq = state.newFreq;
    newMag.fill(0);
    newFreq.fill(0);

    for (let k = 0; k <= HALF; k++) {
      const real = re[k];
      const imag = im[k];
      const mag = Math.sqrt(real * real + imag * imag);
      const phase = Math.atan2(imag, real);

      // Phase delta vs. expected: gives true bin frequency offset.
      let delta = phase - lastAnaPhase[k];
      lastAnaPhase[k] = phase;
      delta -= k * expected;
      delta = wrapPhase(delta);
      // True frequency in bins (k + fractional offset).
      const trueBin = k + (delta * OVERLAP) / (2 * Math.PI);

      // Map this analysis bin to a synthesis bin (round).
      const targetBin = Math.round(k * pitchFactor);
      if (targetBin >= 0 && targetBin <= HALF) {
        // On bin collision, average the true frequency weighted by magnitude
        // so the loudest contributor dominates the synthesis phase.
        const prevMag = newMag[targetBin];
        const totalMag = prevMag + mag;
        if (totalMag > 0) {
          newFreq[targetBin] =
            (newFreq[targetBin] * prevMag + trueBin * pitchFactor * mag) /
            totalMag;
        }
        newMag[targetBin] = totalMag;
      }
    }

    // Synthesis: rebuild the spectrum from newMag/newFreq, accumulating phase.
    for (let k = 0; k <= HALF; k++) {
      // Phase increment for this bin: expected + (freq deviation).
      const freqDev = newFreq[k] - k;
      const phaseInc = k * expected + (freqDev * 2 * Math.PI) / OVERLAP;
      sumPhase[k] = wrapPhase(sumPhase[k] + phaseInc);

      const mag = newMag[k];
      re[k] = mag * Math.cos(sumPhase[k]);
      im[k] = mag * Math.sin(sumPhase[k]);
    }
    // Mirror to the upper half so the IFFT yields a real signal.
    for (let k = 1; k < HALF; k++) {
      re[FFT_SIZE - k] = re[k];
      im[FFT_SIZE - k] = -im[k];
    }
    im[0] = 0;
    im[HALF] = 0;

    ifft(re, im);

    // Overlap-add into the synthesis buffer. The window is applied only on
    // the analysis side; double-windowing would attenuate output by ~4x.
    // The 2/3 normalization compensates for Hann window with 4x overlap.
    const norm = 2 / 3;
    for (let i = 0; i < FFT_SIZE; i++) {
      const idx = (state.outReadPos + state.outAvailable + i) % outBuffer.length;
      outBuffer[idx] += re[i] * norm;
    }
    state.outAvailable += HOP_SIZE;
  }

  process(inputs, outputs) {
    const input = inputs[0];
    const output = outputs[0];
    if (!output || output.length === 0) return true;

    const blockSize = output[0].length || 128;
    const numChannels = output.length;
    const pitchFactor = this._pitchFactor;

    // Pass-through fast path. The FFT pipeline is bypassed entirely so there
    // is no latency or CPU cost when the slider sits at 0 semitones.
    if (Math.abs(pitchFactor - 1.0) < 1e-4) {
      for (let c = 0; c < numChannels; c++) {
        const src = input && (input[c] || input[0]);
        if (src) {
          output[c].set(src);
        } else {
          output[c].fill(0);
        }
      }
      // Reset accumulator state ONLY on the first passthrough block after
      // non-passthrough use. Resetting every block while idle is wasteful
      // and (more importantly) thrashes ring-buffer state needlessly.
      for (let c = 0; c < this._state.length; c++) {
        const s = this._state[c];
        if (!s.wasPassthrough) {
          s.hopCounter = 0;
          s.outReadPos = 0;
          s.outAvailable = 0;
          s.outBuffer.fill(0);
          s.inBuffer.fill(0);
          s.lastAnaPhase.fill(0);
          s.sumPhase.fill(0);
          s.wasPassthrough = true;
        }
      }
      return true;
    }

    this._ensureChannels(numChannels);

    for (let c = 0; c < numChannels; c++) {
      const state = this._state[c];
      // Mark non-passthrough so the next 1.0 block knows to reset state once.
      state.wasPassthrough = false;
      const src = input && (input[c] || input[0]);
      const dst = output[c];

      // Slide inBuffer left by blockSize, append new input at the tail.
      const slide = FFT_SIZE - blockSize;
      if (slide > 0) {
        state.inBuffer.copyWithin(0, blockSize, FFT_SIZE);
      }
      for (let i = 0; i < blockSize; i++) {
        state.inBuffer[slide + i] = src ? src[i] : 0;
      }

      // Run a vocoder frame every HOP_SIZE input samples. With blockSize ===
      // HOP_SIZE (the common 128-sample render quantum) this is exactly once
      // per process() call.
      state.hopCounter += blockSize;
      while (state.hopCounter >= HOP_SIZE) {
        state.hopCounter -= HOP_SIZE;
        this._processFrame(state, pitchFactor);
      }

      // Drain blockSize samples from outBuffer.
      for (let i = 0; i < blockSize; i++) {
        if (state.outAvailable > 0) {
          dst[i] = state.outBuffer[state.outReadPos];
          state.outBuffer[state.outReadPos] = 0;
          state.outReadPos = (state.outReadPos + 1) % state.outBuffer.length;
          state.outAvailable--;
        } else {
          dst[i] = 0;
        }
      }
    }

    return true;
  }
}

registerProcessor('pitch-processor', PitchProcessor);
