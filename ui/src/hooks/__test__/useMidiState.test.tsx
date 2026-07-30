import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RefObject } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { MidiListHandle } from "../../components";
import type { Midi } from "../../types/midi";
import { useMidiState } from "../useMidiState";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const invokeMock = vi.mocked(invoke);

const midi = (overrides: Partial<Midi> = {}): Midi => ({
  id: 1,
  path: "/Users/alice/MIDI/groove.mid",
  file_name: "groove.mid",
  duration: 8,
  tempo: 120,
  time_signature_numerator: 4,
  time_signature_denominator: 4,
  track_count: 2,
  note_count: 32,
  channel_count: 1,
  key_estimate: "C major",
  musical_role: "melody",
  polyphony: "monophonic",
  density: "medium",
  register: "mid",
  bar_count: 2,
  suggested_instrument: null,
  file_size: 1024,
  created_at: "",
  modified_at: "",
  tag_name: "",
  ...overrides,
});

const midiRows = (count: number, startId = 1): Midi[] =>
  Array.from({ length: count }, (_, index) =>
    midi({
      id: startId + index,
      path: `/Users/alice/MIDI/groove-${startId + index}.mid`,
      file_name: `groove-${startId + index}.mid`,
    }),
  );

const renderMidiHook = (params: Partial<Parameters<typeof useMidiState>[0]> = {}) => {
  const setError = vi.fn();
  const midiListRef = { current: { focusSelected: vi.fn() } } satisfies RefObject<MidiListHandle | null>;
  return {
    ...renderHook(() =>
      useMidiState({
        setError,
        pageLimit: 20,
        midiListRef,
        viewMode: "midi",
        autoPlayOnSelect: false,
        ...params,
      }),
    ),
    setError,
  };
};

describe("useMidiState", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockImplementation(async (command) => {
      if (command === "check_timidity") return { installed: true, install_command: "" };
      if (command === "get_all_midi_paths") return ["/Users/alice/MIDI/groove.mid"];
      if (command === "get_midi_tags") return [{ id: 5, name: "Drums", created_at: "" }];
      if (command === "search_midis_paginated") return [midi({ id: 2, file_name: "search.mid" })];
      if (command === "list_midis_paginated") return [midi()];
      if (command === "list_midis_around_id") return [midi({ id: 7 })];
      if (command === "get_midi") return midi({ id: 7 });
      return 1;
    });
  });

  it("runs search and list pagination paths", async () => {
    const { result } = renderMidiHook();

    await act(async () => {
      await result.current.runMidiSearch("search");
    });
    expect(invokeMock).toHaveBeenCalledWith("search_midis_paginated", { query: "search", limit: 20, offset: 0, directoryPath: null, tagId: null });
    expect(result.current.midis[0].file_name).toBe("search.mid");

    await act(async () => {
      await result.current.runMidiSearch("");
    });
    expect(invokeMock).toHaveBeenCalledWith("list_midis_paginated", { limit: 20, offset: 0, directoryPath: null, tagId: null });
    expect(result.current.lastFetchCountMidi).toBe(1);
  });

  it("passes the active MIDI tag filter to paginated search payloads", async () => {
    const { result } = renderMidiHook();
    await waitFor(() => expect(result.current.midiTags).toHaveLength(1));
    invokeMock.mockClear();

    act(() => {
      result.current.setMidiTagFilterId(5);
    });

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("list_midis_paginated", {
        limit: 20,
        offset: 0,
        directoryPath: null,
        tagId: 5,
      });
    });

    invokeMock.mockClear();
    await act(async () => {
      await result.current.runMidiSearch("search");
    });

    expect(invokeMock).toHaveBeenCalledWith("search_midis_paginated", {
      query: "search",
      limit: 20,
      offset: 0,
      directoryPath: null,
      tagId: 5,
    });
  });

  it("selects MIDI, auto-plays, and toggles stop", async () => {
    const { result } = renderMidiHook({ autoPlayOnSelect: true });

    await act(async () => {
      await result.current.handleMidiSelect(midi());
    });

    expect(invokeMock).toHaveBeenCalledWith("play_midi", { path: "/Users/alice/MIDI/groove.mid" });
    expect(result.current.selectedMidi?.id).toBe(1);
    expect(result.current.isMidiPlaying).toBe(true);

    await act(async () => {
      await result.current.togglePlaySelectedMidi();
    });
    expect(invokeMock).toHaveBeenCalledWith("stop_midi");
    expect(result.current.isMidiPlaying).toBe(false);
  });

  it("updates MIDI tags and trashes selected rows", async () => {
    const { result } = renderMidiHook();
    await waitFor(() => expect(result.current.midiTags).toHaveLength(1));
    await act(async () => {
      await result.current.runMidiSearch("");
    });

    await act(async () => {
      await result.current.handleMidiTagChange(1, 5);
    });
    expect(invokeMock).toHaveBeenCalledWith("set_midi_file_tag", { midiId: 1, tagId: 5 });
    expect(result.current.midis[0].tag_name).toBe("Drums");

    act(() => result.current.requestTrashMidi(1));
    await act(async () => {
      await result.current.confirmTrashMidi();
    });
    expect(invokeMock).toHaveBeenCalledWith("send_to_trash", { path: "/Users/alice/MIDI/groove.mid" });
    expect(result.current.confirmOpen).toBe(false);
  });

  it("loads MIDI by path, fetches all paths, and derives scanned folders", async () => {
    const { result } = renderMidiHook({ autoPlayOnSelect: true });

    await waitFor(() => expect(result.current.allMidiPaths).toEqual(["/Users/alice/MIDI/groove.mid"]));
    expect(result.current.midiScannedPaths.some((path) => path.endsWith("/Users/alice/MIDI"))).toBe(true);

    await act(async () => {
      await result.current.fetchAllMidiPaths();
      await result.current.loadMidiByPath("/Users/alice/MIDI/groove.mid");
    });

    expect(invokeMock).toHaveBeenCalledWith("get_midi", { path: "/Users/alice/MIDI/groove.mid" });
    expect(invokeMock).toHaveBeenCalledWith("list_midis_around_id", { targetId: 7, limit: 20 });
    expect(invokeMock).toHaveBeenCalledWith("play_midi", { path: "/Users/alice/MIDI/groove.mid" });
    expect(result.current.selectedMidi?.id).toBe(7);
    expect(result.current.isMidiPlaying).toBe(true);
  });

  it("adds, deletes, and updates MIDI tags", async () => {
    const { result } = renderMidiHook();
    await waitFor(() => expect(result.current.midiTags).toHaveLength(1));

    await act(async () => {
      await result.current.handleAddMidiTag("Bassline");
      await result.current.handleUpdateMidiTag(5, "Drums Edited");
      await result.current.handleDeleteMidiTag(5);
    });

    expect(invokeMock).toHaveBeenCalledWith("add_midi_tag", { name: "Bassline" });
    expect(invokeMock).toHaveBeenCalledWith("update_midi_tag", { id: 5, name: "Drums Edited" });
    expect(invokeMock).toHaveBeenCalledWith("delete_midi_tag", { id: 5 });
    expect(invokeMock).toHaveBeenCalledWith("get_midi_tags");
  });

  it("loads more, jumps around, and loads previous MIDI rows", async () => {
    invokeMock.mockImplementation(async (command, payload) => {
      if (command === "check_timidity") return { installed: true, install_command: "" };
      if (command === "get_all_midi_paths") return [];
      if (command === "get_midi_tags") return [];
      if (command === "list_midis_paginated") {
        const offset = typeof payload === "object" && payload !== null && "offset" in payload ? Number(payload.offset) : 0;
        return midiRows(1, 20 + offset);
      }
      if (command === "list_midis_around_id") return midiRows(1, 40);
      return 1;
    });
    const { result } = renderMidiHook({ pageLimit: 1 });
    await waitFor(() => expect(result.current.canLoadMoreMidi).toBe(true));

    invokeMock.mockClear();
    act(() => {
      result.current.setMidiTagFilterId(5);
    });
    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("list_midis_paginated", { limit: 1, offset: 0, directoryPath: null, tagId: 5 });
    });
    invokeMock.mockClear();

    await act(async () => {
      await result.current.loadMoreMidi();
    });
    expect(invokeMock).toHaveBeenCalledWith("list_midis_paginated", { limit: 1, offset: 1, directoryPath: null, tagId: 5 });

    await act(async () => {
      await result.current.loadAroundMidi(7);
    });
    expect(invokeMock).toHaveBeenCalledWith("list_midis_paginated", { limit: 1, offset: 0, directoryPath: null, tagId: 5 });
    expect(result.current.canLoadPreviousMidi).toBe(false);

    await act(async () => {
      await result.current.loadPreviousMidi();
    });
    expect(result.current.canLoadPreviousMidi).toBe(false);
  });

  it("reports playback errors and leaves playback stopped", async () => {
    const { result, setError } = renderMidiHook();

    await act(async () => {
      await result.current.handleMidiSelect(midi());
    });
    invokeMock.mockImplementation(async (command) => {
      if (command === "play_midi") throw new Error("play failed");
      return 1;
    });

    await act(async () => {
      await result.current.togglePlaySelectedMidi();
    });

    expect(setError).toHaveBeenCalledWith("play failed");
    expect(result.current.isMidiPlaying).toBe(false);
  });

  it("closes trash confirmation without invoking Tauri when a MIDI row has no path", async () => {
    const { result } = renderMidiHook();

    act(() => result.current.setMidis([midi({ id: 99, path: "" })]));
    act(() => result.current.requestTrashMidi(99));
    invokeMock.mockClear();

    await act(async () => {
      await result.current.confirmTrashMidi();
    });

    expect(invokeMock).not.toHaveBeenCalled();
    expect(result.current.confirmOpen).toBe(false);
    expect(result.current.pendingTrashMidiId).toBeNull();
  });
});
