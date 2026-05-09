import { renderHook } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { useDisplayedSamples, useFilteredMidis } from "../useDisplayedSamples";
import type { FilterState, Sample } from "../../types/sample";
import type { Midi } from "../../types/midi";

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
    tags: [],
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

const midis: Midi[] = [
  {
    id: 1,
    path: "/midi/drums.mid",
    file_name: "drums.mid",
    duration: null,
    tempo: null,
    time_signature_numerator: 4,
    time_signature_denominator: 4,
    track_count: null,
    note_count: null,
    channel_count: null,
    key_estimate: null,
    file_size: null,
    created_at: "",
    modified_at: "",
    tag_name: "drums",
  },
  {
    id: 2,
    path: "/midi/piano.mid",
    file_name: "piano.mid",
    duration: null,
    tempo: null,
    time_signature_numerator: 4,
    time_signature_denominator: 4,
    track_count: null,
    note_count: null,
    channel_count: null,
    key_estimate: null,
    file_size: null,
    created_at: "",
    modified_at: "",
    tag_name: "piano",
  },
];

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

  test("filters MIDI rows by selected tag", () => {
    const { result } = renderHook(() => useFilteredMidis(midis, 2, [{ id: 2, name: "piano" }]));

    expect(result.current).toEqual([midis[1]]);
  });

  test("returns all MIDI rows without a tag filter", () => {
    const { result } = renderHook(() => useFilteredMidis(midis, null, []));

    expect(result.current).toEqual(midis);
  });
});
