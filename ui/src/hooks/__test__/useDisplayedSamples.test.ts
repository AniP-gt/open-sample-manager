import { renderHook } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { useDisplayedSamples } from "../useDisplayedSamples";
import type { FilterState, Sample } from "../../types/sample";

const samples: Sample[] = [
  {
    id: 1,
    file_name: "kick.wav",
    duration: 1,
    bpm: 120,
    periodicity: 0,
    low_ratio: 0.8,
    sample_rate: 44100,
    attack_slope: 0.9,
    decay_time: null,
    sample_type: "one-shot",
    tags: ["drums", "warm"],
    waveform_peaks: null,
    playback_type: "oneshot",
    instrument_type: "kick",
    musical_key: "C",
  },
  {
    id: 2,
    file_name: "snare.wav",
    duration: 1,
    bpm: 120,
    periodicity: 0,
    low_ratio: 0.4,
    sample_rate: 44100,
    attack_slope: 0.8,
    decay_time: null,
    sample_type: "one-shot",
    tags: [],
    waveform_peaks: null,
    playback_type: "oneshot",
    instrument_type: "snare",
    musical_key: "D",
  },
];

const filters: FilterState = {
  filterType: "all",
  search: "",
  filterBpmMin: "",
  filterBpmMax: "",
  filterInstrumentType: "",
  filterKey: "All",
  favoritesOnly: false,
};

describe("display hooks", () => {
  test("filters samples by favorites and key", () => {
    const { result } = renderHook(() =>
      useDisplayedSamples(samples, { ...filters, favoritesOnly: true, filterKey: "D" }, [1, 2])
    );

    expect(result.current).toEqual([samples[1]]);
  });

  test("returns all samples when optional filters are inactive", () => {
    const { result } = renderHook(() => useDisplayedSamples(samples, filters, []));

    expect(result.current).toEqual(samples);
  });

  test("filters samples by BPM, type, instrument, filename, and tags", () => {
    const { result } = renderHook(() =>
      useDisplayedSamples(
        samples,
        {
          ...filters,
          search: "warm",
          filterBpmMin: "110",
          filterBpmMax: "125",
          filterType: "one-shot",
          filterInstrumentType: "kick",
        },
        [],
      )
    );

    expect(result.current).toEqual([samples[0]]);
  });

  test("keeps fuzzy tag matches returned by backend search", () => {
    const { result } = renderHook(() => useDisplayedSamples(samples, { ...filters, search: "drm" }, []));

    expect(result.current).toEqual([samples[0]]);
  });

  test("ignores invalid BPM bounds", () => {
    const { result } = renderHook(() =>
      useDisplayedSamples(samples, { ...filters, filterBpmMin: "nope", filterBpmMax: "also-nope" }, [])
    );

    expect(result.current).toEqual(samples);
  });

});
