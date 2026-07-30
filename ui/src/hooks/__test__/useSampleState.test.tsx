import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RefObject } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { PlayerBarHandle, MidiListHandle } from "../../components";
import type { SampleListHandle } from "../../components/SampleList/types";
import type { Midi } from "../../types/midi";
import type { TauriSampleRow } from "../../types/tauri";
import { useSampleState } from "../useSampleState";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const invokeMock = vi.mocked(invoke);

const sampleRow = (overrides: Partial<TauriSampleRow> = {}): TauriSampleRow => ({
  id: 10,
  path: "/Users/alice/Samples/kick.wav",
  file_name: "kick.wav",
  duration: 0.5,
  bpm: 124,
  periodicity: 0.4,
  sample_rate: 44_100,
  low_ratio: 0.8,
  attack_slope: 0.7,
  decay_time: 0.2,
  sample_type: "kick",
  waveform_peaks: "[0,1]",
  playback_type: "oneshot",
  instrument_type: "kick",
  musical_key: "C",
  source: null,
  pack_name: null,
  license: null,
  license_url: null,
  license_memo: null,
  imported_at: null,
  peak_db: null,
  rms_db: null,
  leading_silence_ms: null,
  clipping_count: null,
  channel_count: null,
  bit_depth: null,
  quality_flags: null,
  content_hash: null,
  duplicate_count: null,
  tags: [],
  ...overrides,
});

const sampleRows = (count: number, startId = 10): TauriSampleRow[] =>
  Array.from({ length: count }, (_, index) =>
    sampleRow({
      id: startId + index,
      path: `/Users/alice/Samples/sample-${startId + index}.wav`,
      file_name: `sample-${startId + index}.wav`,
    }),
  );

const midiRow: Midi = {
  id: 3,
  path: "/Users/alice/MIDI/groove.mid",
  file_name: "groove.mid",
  duration: 4,
  tempo: 120,
  time_signature_numerator: 4,
  time_signature_denominator: 4,
  track_count: 1,
  note_count: 8,
  channel_count: 1,
  key_estimate: "C",
  musical_role: "melody",
  polyphony: "monophonic",
  density: "medium",
  register: "mid",
  bar_count: 1,
  suggested_instrument: null,
  file_size: 256,
  created_at: "",
  modified_at: "",
  tag_name: "",
};

const renderSampleHook = (pageLimit = 20) => {
  const setError = vi.fn();
  const setMidis = vi.fn();
  const setSelectedMidi = vi.fn();
  const fetchAllMidiPaths = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  const sampleListRef = { current: { focusSelected: vi.fn() } } satisfies RefObject<SampleListHandle | null>;
  const midiListRef = { current: { focusSelected: vi.fn() } } satisfies RefObject<MidiListHandle | null>;
  const playerBar: PlayerBarHandle = { stop: vi.fn(), play: vi.fn(), toggle: vi.fn(), isPlaying: false };
  const playerBarRef = { current: playerBar } satisfies RefObject<PlayerBarHandle | null>;

  return {
    ...renderHook(() =>
      useSampleState({
        setError,
        sampleListRef,
        midiListRef,
        playerBarRef,
        pageLimit,
        setMidis,
        setSelectedMidi,
        fetchAllMidiPaths,
      }),
    ),
    setError,
    setMidis,
    setSelectedMidi,
    fetchAllMidiPaths,
    sampleListRef,
    midiListRef,
    playerBarRef,
  };
};

describe("useSampleState", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockImplementation(async (command) => {
      if (command === "get_instrument_types") {
        return [
          { id: 1, name: "kick", created_at: "" },
          { id: 2, name: "snare", created_at: "" },
        ];
      }
      if (command === "list_all_sample_paths") return ["/Users/alice/Samples/kick.wav"];
      if (command === "list_samples_paginated") return [sampleRow()];
      if (command === "list_samples_around_id") return [sampleRow()];
      if (command === "get_sample") return sampleRow({ id: 12, path: "/Users/alice/Samples/snare.wav" });
      if (command === "get_midi") return midiRow;
      return 1;
    });
  });

  it("loads samples, paths, and scanned folder state from search", async () => {
    const { result } = renderSampleHook();

    await waitFor(() => expect(result.current.samples).toHaveLength(1));

    expect(result.current.samples[0]).toMatchObject({ file_name: "kick.wav", instrument_type: "kick" });
    expect(result.current.samplePaths[10]).toBe("/Users/alice/Samples/kick.wav");
    expect(result.current.allSamplePaths).toEqual(["/Users/alice/Samples/kick.wav"]);
    expect(result.current.scannedPaths.some((path) => path.endsWith("/Users/alice/Samples"))).toBe(true);
  });

  it("keeps scanned folder state stable when directory filtering changes visible rows", async () => {
    invokeMock.mockImplementation(async (command, payload) => {
      if (command === "get_instrument_types") return [];
      if (command === "list_all_sample_paths") {
        return [
          "/Users/alice/Samples/drums/kick.wav",
          "/Users/alice/Samples/loops/beat.wav",
        ];
      }
      if (command === "list_samples_paginated") {
        const directoryPath =
          typeof payload === "object" && payload !== null && "directoryPath" in payload
            ? payload.directoryPath
            : null;

        return directoryPath
          ? [sampleRow({ id: 11, path: "/Users/alice/Samples/loops/beat.wav", file_name: "beat.wav" })]
          : [sampleRow({ id: 10, path: "/Users/alice/Samples/drums/kick.wav", file_name: "kick.wav" })];
      }
      return 1;
    });
    const { result } = renderSampleHook();

    await waitFor(() =>
      expect(result.current.scannedPaths).toEqual([
        "/Users",
        "/Users/alice",
        "/Users/alice/Samples",
        "/Users/alice/Samples/drums",
        "/Users/alice/Samples/loops",
      ]),
    );
    const initialScannedPaths = result.current.scannedPaths;

    act(() => {
      result.current.handleFilterChange({ directoryPath: "/Users/alice/Samples/loops" });
    });

    await waitFor(() => expect(result.current.samples[0].file_name).toBe("beat.wav"));
    expect(result.current.scannedPaths).toEqual(initialScannedPaths);
  });

  it("deletes and trashes samples by the mapped backend path", async () => {
    const { result } = renderSampleHook();
    await waitFor(() => expect(result.current.samplePaths[10]).toBeTruthy());

    await act(async () => {
      await result.current.handleDeleteSample(10);
    });
    expect(invokeMock).toHaveBeenCalledWith("delete_sample", { path: "/Users/alice/Samples/kick.wav" });

    act(() => result.current.requestTrash(10));
    expect(result.current.confirmOpen).toBe(true);

    await act(async () => {
      await result.current.confirmTrash();
    });
    expect(invokeMock).toHaveBeenCalledWith("send_to_trash", { path: "/Users/alice/Samples/kick.wav" });
    expect(result.current.confirmOpen).toBe(false);
  });

  it("saves classification edits with normalized playback payload", async () => {
    const { result } = renderSampleHook();
    await waitFor(() => expect(result.current.instrumentTypes).toHaveLength(2));
    const sample = result.current.samples[0];

    act(() => result.current.handleTypeClick(sample));
    act(() => result.current.handleSampleTypeSelect("loop"));
    act(() => result.current.setEditInstrumentType("snare"));

    await act(async () => {
      await result.current.handleClassificationSave();
    });

    expect(invokeMock).toHaveBeenCalledWith("update_sample_classification", {
      path: "/Users/alice/Samples/kick.wav",
      playbackType: "loop",
      instrumentType: "snare",
    });
    expect(result.current.classificationModalOpen).toBe(false);
  });

  it("reports search errors and retries the saved search", async () => {
    const { result, setError } = renderSampleHook();
    await waitFor(() => expect(result.current.samples).toHaveLength(1));
    let failSearch = true;
    invokeMock.mockImplementation(async (command) => {
      if (command === "list_samples_paginated" && failSearch) throw new Error("search failed");
      if (command === "list_samples_paginated") return [sampleRow({ id: 11, file_name: "retry.wav" })];
      if (command === "get_instrument_types") return [];
      if (command === "list_all_sample_paths") return [];
      return 1;
    });

    await act(async () => {
      await result.current.handleSearch("bad");
    });
    expect(setError).toHaveBeenCalledWith("search failed");

    failSearch = false;
    await act(async () => {
      await result.current.handleRetry();
    });
    expect(result.current.samples[0].file_name).toBe("retry.wav");
    expect(setError).toHaveBeenLastCalledWith(null);
  });

  it("loads individual sample and MIDI rows by path", async () => {
    const { result, setSelectedMidi } = renderSampleHook();

    await act(async () => {
      await result.current.loadSampleByPath("/Users/alice/Samples/snare.wav");
    });
    expect(invokeMock).toHaveBeenCalledWith("get_sample", { path: "/Users/alice/Samples/snare.wav" });
    expect(invokeMock).toHaveBeenCalledWith("list_samples_around_id", { targetId: 12, limit: 20 });
    expect(result.current.selected?.id).toBe(12);

    await act(async () => {
      await result.current.loadMidiByPath("/Users/alice/MIDI/groove.mid");
    });
    expect(invokeMock).toHaveBeenCalledWith("get_midi", { path: "/Users/alice/MIDI/groove.mid" });
    expect(setSelectedMidi).toHaveBeenCalledWith(midiRow);
  });

  it("clears all indexed rows and supports trash cancellation", async () => {
    const { result, setMidis, setSelectedMidi, fetchAllMidiPaths } = renderSampleHook();
    await waitFor(() => expect(result.current.samples).toHaveLength(1));

    act(() => result.current.requestTrash(10));
    expect(result.current.confirmOpen).toBe(true);
    act(() => result.current.cancelTrash());
    expect(result.current.pendingTrashSampleId).toBeNull();
    expect(result.current.confirmOpen).toBe(false);

    await act(async () => {
      await result.current.handleClearAllSamples();
    });
    expect(invokeMock).toHaveBeenCalledWith("clear_all_samples");
    expect(invokeMock).toHaveBeenCalledWith("clear_all_midis");
    expect(result.current.samples).toEqual([]);
    expect(result.current.samplePaths).toEqual({});
    expect(setMidis).toHaveBeenCalledWith([]);
    expect(setSelectedMidi).toHaveBeenCalledWith(null);
    expect(fetchAllMidiPaths).toHaveBeenCalled();
  });

  it("adds, deletes, and updates instrument types", async () => {
    const { result } = renderSampleHook();
    await waitFor(() => expect(result.current.instrumentTypes).toHaveLength(2));

    await act(async () => {
      await result.current.handleAddInstrumentType("clap");
      await result.current.handleUpdateInstrumentType(2, "rim");
      await result.current.handleDeleteInstrumentType(2);
    });

    expect(invokeMock).toHaveBeenCalledWith("add_instrument_type", { name: "clap" });
    expect(invokeMock).toHaveBeenCalledWith("update_instrument_type", { id: 2, name: "rim" });
    expect(invokeMock).toHaveBeenCalledWith("delete_instrument_type", { id: 2 });
    expect(invokeMock).toHaveBeenCalledWith("get_instrument_types");
  });

  it("loads more, jumps around, and loads previous samples", async () => {
    invokeMock.mockImplementation(async (command, payload) => {
      if (command === "get_instrument_types") return [];
      if (command === "list_all_sample_paths") return [];
      if (command === "list_samples_paginated") {
        const offset = typeof payload === "object" && payload !== null && "offset" in payload ? Number(payload.offset) : 0;
        return sampleRows(1, 20 + offset);
      }
      if (command === "list_samples_around_id") return sampleRows(1, 40);
      return 1;
    });
    const { result } = renderSampleHook(1);
    await waitFor(() => expect(result.current.samples).toHaveLength(1));

    await act(async () => {
      await result.current.loadMore();
    });
    expect(invokeMock).toHaveBeenCalledWith("list_samples_paginated", { query: null, limit: 1, offset: 1, directoryPath: null });

    await act(async () => {
      await result.current.loadAround(12);
    });
    expect(invokeMock).toHaveBeenCalledWith("list_samples_around_id", { targetId: 12, limit: 1 });
    expect(result.current.canLoadPrevious).toBe(true);

    await act(async () => {
      await result.current.loadPrevious();
    });
    expect(invokeMock).toHaveBeenCalledWith("list_samples_paginated", { query: null, limit: 1, offset: 11, directoryPath: null });
  });

  it("toggles sample playback through the player ref", async () => {
    const { result, playerBarRef } = renderSampleHook();
    await waitFor(() => expect(result.current.samples).toHaveLength(1));

    await act(async () => {
      await result.current.handleSampleSelect(result.current.samples[0]);
    });
    act(() => result.current.togglePlayback());
    expect(playerBarRef.current?.play).toHaveBeenCalled();

    if (playerBarRef.current) {
      playerBarRef.current.isPlaying = true;
    }
    act(() => result.current.togglePlayback());
    expect(playerBarRef.current?.stop).toHaveBeenCalled();
  });

  it("restores the original search snapshot after repeated external result commands", async () => {
    invokeMock.mockImplementation(async (command) => {
      if (command === "get_instrument_types") return [];
      if (command === "list_all_sample_paths") return [];
      if (command === "list_samples_paginated") return [sampleRow({ id: 9, file_name: "search-result.wav" })];
      return 1;
    });
    const { result } = renderSampleHook();
    await waitFor(() => expect(result.current.samples[0]?.id).toBe(9));
    const normalSample = result.current.samples[0];
    if (!normalSample) throw new Error("Expected initial search result");

    act(() => {
      result.current.handleFilterChange({ search: "original query" });
      result.current.setSort({ field: "file_name", direction: "desc" });
      result.current.setSelected(normalSample);
    });
    await waitFor(() => expect(result.current.filters.search).toBe("original query"));

    const firstExternal = sampleRow({ id: 3, file_name: "three.wav" });
    const secondExternal = sampleRow({ id: 1, file_name: "one.wav" });
    act(() => {
      result.current.showExternalResults({
        samples: [
          { ...normalSample, id: 3, file_name: "three.wav" },
          { ...normalSample, id: 1, file_name: "one.wav" },
        ],
        samplePaths: { 3: firstExternal.path, 1: secondExternal.path },
        selectedId: 1,
      });
    });
    await waitFor(() => expect(result.current.externalResults?.map((sample) => sample.id)).toEqual([3, 1]));

    act(() => {
      result.current.showExternalResults({
        samples: [{ ...normalSample, id: 2, file_name: "two.wav" }],
        samplePaths: { 2: "/Users/alice/Samples/two.wav" },
        selectedId: 2,
      });
    });
    await waitFor(() => expect(result.current.externalResults?.map((sample) => sample.id)).toEqual([2]));

    act(() => {
      result.current.restoreSearchResults();
    });

    expect(result.current.externalResults).toBeNull();
    expect(result.current.samples.map((sample) => sample.id)).toEqual([9]);
    expect(result.current.filters.search).toBe("original query");
    expect(result.current.sort).toEqual({ field: "file_name", direction: "desc" });
    expect(result.current.selected?.id).toBe(9);
  });
});
