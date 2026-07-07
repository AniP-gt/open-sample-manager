import { describe, expect, it } from "vitest";
import { renderHook } from "@testing-library/react";
import { useDisplayedSamples } from "../useDisplayedSamples";
import type { FilterState, Sample } from "../../types/sample";

const filters: FilterState = {
  search: "",
  filterType: "all",
  filterBpmMin: "",
  filterBpmMax: "",
  filterInstrumentType: "",
  favoritesOnly: false,
  hideDuplicates: true,
  filterKey: "",
  directoryPath: "",
};

const sample = (id: number, contentHash?: string): Sample => ({
  id,
  file_name: `sample-${id}.wav`,
  duration: 1,
  bpm: null,
  periodicity: 0,
  low_ratio: 0,
  attack_slope: 0,
  decay_time: null,
  sample_type: "one-shot",
  tags: [],
  waveform_peaks: null,
  playback_type: "oneshot",
  instrument_type: "other",
  content_hash: contentHash,
  duplicate_count: contentHash ? 2 : 1,
});

describe("useDisplayedSamples duplicate filtering", () => {
  it("keeps the first visible sample for each duplicate content hash", () => {
    const samples = [sample(1, "same"), sample(2, "same"), sample(3, "other")];
    const { result } = renderHook(() => useDisplayedSamples(samples, filters, []));

    expect(result.current.map((item) => item.id)).toEqual([1, 3]);
  });
});
