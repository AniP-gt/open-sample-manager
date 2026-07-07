import { describe, expect, test } from "vitest";
import type { Sample } from "../../types/sample";
import { matchesSampleSearchDsl, parseSampleSearchDsl } from "../searchDsl";

const sample: Sample = {
  id: 1,
  file_name: "metal_kick.wav",
  duration: 1,
  bpm: 140,
  periodicity: 0,
  low_ratio: 0.8,
  sample_rate: 44100,
  attack_slope: 0.9,
  decay_time: null,
  sample_type: "one-shot",
  tags: ["metal", "drums"],
  waveform_peaks: null,
  playback_type: "oneshot",
  instrument_type: "kick",
  musical_key: "A",
  quality_flags: [],
};

describe("search DSL", () => {
  test("parses whitelisted fields and keeps plain text terms", () => {
    expect(parseSampleSearchDsl("kick bpm:120-180 type:oneshot tag:metal")).toMatchObject({
      textTerms: ["kick"],
      bpm: { min: 120, max: 180 },
      playbackType: "oneshot",
      tags: ["metal"],
    });
  });

  test("matches sample DSL examples", () => {
    expect(matchesSampleSearchDsl("kick bpm:120-180 type:one-shot tag:metal key:Am", sample)).toBe(true);
    expect(matchesSampleSearchDsl("kick bpm:90-110 type:one-shot tag:metal", sample)).toBe(false);
  });

  test("supports negative plain terms and tag clauses", () => {
    expect(matchesSampleSearchDsl("kick -rimshot -tag:rimshot", sample)).toBe(true);
    expect(matchesSampleSearchDsl("kick -metal", sample)).toBe(false);
    expect(matchesSampleSearchDsl("kick -tag:metal", sample)).toBe(false);
  });

  test("matches favorite clauses from caller state", () => {
    expect(matchesSampleSearchDsl("favorite:true", sample, true)).toBe(true);
    expect(matchesSampleSearchDsl("favorite:true", sample, false)).toBe(false);
    expect(matchesSampleSearchDsl("favorite:false", sample, false)).toBe(true);
  });
});
