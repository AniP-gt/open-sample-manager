import { afterEach, beforeAll, beforeEach, vi } from "vitest";
import type { Sample, SampleProcessingSettings } from "../../../types/sample";

export const mockPlay = vi.fn().mockResolvedValue(undefined);
export const mockPause = vi.fn();

export const dummySample: Sample = {
  id: 1,
  file_name: "test.wav",
  duration: 10,
  bpm: 120,
  periodicity: 0,
  low_ratio: 0.5,
  sample_rate: 44100,
  attack_slope: 0.6,
  decay_time: null,
  sample_type: "one-shot",
  tags: [],
  waveform_peaks: null,
  playback_type: "oneshot",
  instrument_type: "kick",
  musical_key: "C",
  quality_flags: [],
};

export const editedSettings: SampleProcessingSettings = {
  trimStartSeconds: 1.25,
  trimEndSeconds: 4.5,
  fadeInSeconds: 0.2,
  fadeOutSeconds: 0.3,
  gainDb: 3,
};

beforeAll(() => {
  Object.defineProperty(window.HTMLMediaElement.prototype, "play", {
    configurable: true,
    value: mockPlay,
  });
  Object.defineProperty(window.HTMLMediaElement.prototype, "pause", {
    configurable: true,
    value: mockPause,
  });
});

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});
