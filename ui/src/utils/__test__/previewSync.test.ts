import { describe, expect, it } from "vitest";
import {
  buildPreviewSyncResult,
  computeShortestSemitoneShift,
  computeTempoRate,
  normalizeKey,
  parseMidiKeyEstimate,
  parseProjectBpm,
} from "../previewSync";

describe("previewSync", () => {
  it("normalizes sharp, flat, and MIDI key estimate labels", () => {
    expect(normalizeKey("c# minor")).toBe("C#");
    expect(normalizeKey("Db major")).toBe("C#");
    expect(parseMidiKeyEstimate("F♯ minor")).toBe("F#");
    expect(parseMidiKeyEstimate("unknown")).toBeNull();
  });

  it("computes tempo playback rate only for valid BPM values", () => {
    expect(computeTempoRate(100, 125)).toBe(1.25);
    expect(computeTempoRate(null, 125)).toBeNull();
    expect(parseProjectBpm("140")).toBe(140);
    expect(parseProjectBpm("0")).toBeNull();
  });

  it("computes the shortest semitone shift", () => {
    expect(computeShortestSemitoneShift("C", "G")).toBe(7 - 12);
    expect(computeShortestSemitoneShift("B", "C")).toBe(1);
    expect(computeShortestSemitoneShift("D", "Bb")).toBe(-4);
    expect(computeShortestSemitoneShift("", "C")).toBeNull();
  });

  it("builds preview invoke options from enabled sync settings", () => {
    expect(
      buildPreviewSyncResult(
        { projectBpm: "150", projectKey: "G", tempoSync: true, keySync: true },
        120,
        "C",
      ),
    ).toEqual({ targetBpm: 150, transposeSemitones: -5 });
    expect(
      buildPreviewSyncResult(
        { projectBpm: "150", projectKey: "G", tempoSync: false, keySync: false },
        120,
        "C",
      ),
    ).toEqual({});
  });
});
