import { describe, expect, it } from "vitest";
import type { TauriSampleRow } from "../../types/tauri";
import { getErrorMessage, mapRowToSample, normalizeSampleType } from "../sampleMapper";

const baseRow = (overrides: Partial<TauriSampleRow> = {}): TauriSampleRow => ({
  id: 7,
  path: "/Users/alice/Samples/kick.wav",
  file_name: "kick.wav",
  duration: null,
  bpm: 128,
  periodicity: null,
  sample_rate: null,
  low_ratio: null,
  attack_slope: null,
  decay_time: null,
  sample_type: null,
  waveform_peaks: null,
  playback_type: "oneshot",
  instrument_type: "",
  musical_key: null,
  tags: [],
  ...overrides,
});

describe("normalizeSampleType", () => {
  it("prefers loop when either backend field marks a loop", () => {
    expect(normalizeSampleType("loop", null)).toBe("loop");
    expect(normalizeSampleType("oneshot", "loop")).toBe("loop");
  });

  it("normalizes legacy non-loop values to one-shot", () => {
    expect(normalizeSampleType("oneshot", "kick")).toBe("one-shot");
    expect(normalizeSampleType(null, null)).toBe("one-shot");
  });
});

describe("mapRowToSample", () => {
  it("fills UI defaults and parses waveform peaks", () => {
    const sample = mapRowToSample(
      baseRow({
        duration: 1.5,
        periodicity: 0.8,
        sample_rate: 48_000,
        low_ratio: 0.2,
        attack_slope: 0.9,
        waveform_peaks: "[0,0.25,1]",
        playback_type: "loop",
        instrument_type: "Snare",
        musical_key: "C#",
        tags: ["drums", "favorite"],
      }),
    );

    expect(sample).toMatchObject({
      id: 7,
      file_name: "kick.wav",
      duration: 1.5,
      periodicity: 0.8,
      sample_rate: 48_000,
      low_ratio: 0.2,
      attack_slope: 0.9,
      sample_type: "loop",
      playback_type: "loop",
      instrument_type: "snare",
      musical_key: "C#",
    });
    expect(sample.waveform_peaks).toEqual([0, 0.25, 1]);
    expect(sample.tags).toEqual(["drums", "favorite"]);
  });

  it("falls back safely for invalid peaks and legacy kick sample_type", () => {
    const sample = mapRowToSample(baseRow({ sample_type: "kick", waveform_peaks: "not json" }));

    expect(sample.duration).toBe(0);
    expect(sample.periodicity).toBe(0);
    expect(sample.waveform_peaks).toBeNull();
    expect(sample.sample_type).toBe("one-shot");
    expect(sample.playback_type).toBe("oneshot");
    expect(sample.instrument_type).toBe("kick");
  });
});

describe("getErrorMessage", () => {
  it("extracts Error and message-shaped values", () => {
    expect(getErrorMessage(new Error("boom"))).toBe("boom");
    expect(getErrorMessage({ message: "from backend" })).toBe("from backend");
    expect(getErrorMessage("plain failure")).toBe("plain failure");
  });
});
