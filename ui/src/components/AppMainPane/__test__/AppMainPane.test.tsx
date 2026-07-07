import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { AppMainPane } from "../AppMainPane";
import type { Sample } from "../../../types/sample";
import type { Midi } from "../../../types/midi";
import type { PlayerBarHandle } from "../../PlayerBar/PlayerBar";
import type { SampleListHandle } from "../../SampleList/types";
import type { MidiListHandle } from "../../MidiList/types";
import type { useUIState } from "../../../hooks/useUIState";
import type { useScanState } from "../../../hooks/useScanState";
import type { useSampleState } from "../../../hooks/useSampleState";
import type { useMidiState } from "../../../hooks/useMidiState";

type Callback = (...args: unknown[]) => unknown;

const getCallback = (props: Record<string, unknown>, name: string) => props[name] as Callback;

vi.mock("../..", async () => {
  const React = await vi.importActual<typeof import("react")>("react");

  return {
    FilterSidebar: (props: Record<string, unknown>) =>
      React.createElement("div", { "data-testid": "filter-sidebar" }, [
        React.createElement("button", { key: "file", onClick: () => getCallback(props, "onPathSelect")("/library/kick.wav") }, "filter file"),
        React.createElement("button", { key: "dir", onClick: () => getCallback(props, "onPathSelect")("/library/drums") }, "filter dir"),
        React.createElement("button", { key: "sample", onClick: () => getCallback(props, "onSampleSelect")({ id: 1 }) }, "sidebar sample"),
        React.createElement("button", { key: "import", onClick: () => getCallback(props, "onImportPaths")(["/drop.wav"]) }, "sidebar import"),
        React.createElement("button", { key: "clear", onClick: () => getCallback(props, "onClearDirectoryPath")() }, "sidebar clear"),
      ]),
    SampleList: React.forwardRef((_props: Record<string, unknown>, _ref) => {
      const props = _props;
      return React.createElement("div", { "data-testid": "sample-list" }, [
        React.createElement("button", { key: "select", onClick: () => getCallback(props, "onSampleSelect")({ id: 1 }) }, "sample select"),
        React.createElement("button", { key: "filter", onClick: () => getCallback(props, "onFilterChange")({ search: "kick" }) }, "sample filter"),
        React.createElement("button", { key: "sort", onClick: () => getCallback(props, "onSortChange")({ field: "bpm", direction: "desc" }) }, "sample sort"),
        React.createElement("button", { key: "delete", onClick: () => getCallback(props, "onDeleteSample")(1) }, "sample delete"),
        React.createElement("button", { key: "trash", onClick: () => getCallback(props, "onTrashSample")(1) }, "sample trash"),
        React.createElement("button", { key: "type", onClick: () => getCallback(props, "onTypeClick")({ id: 1 }) }, "sample type"),
        React.createElement("button", { key: "import", onClick: () => getCallback(props, "onImportPaths")(["/drop.wav"]) }, "sample import"),
        React.createElement("button", { key: "more", onClick: () => getCallback(props, "onLoadMore")() }, "sample more"),
        React.createElement("button", { key: "prev", onClick: () => getCallback(props, "onLoadPrevious")() }, "sample prev"),
        React.createElement("button", { key: "play", onClick: () => getCallback(props, "onTogglePlayback")() }, "sample play"),
      ]);
    }),
    MidiList: React.forwardRef((_props: Record<string, unknown>, _ref) => {
      const props = _props;
      return React.createElement("div", { "data-testid": "midi-list" }, [
        React.createElement("button", { key: "select", onClick: () => getCallback(props, "onMidiSelect")({ id: 2 }) }, "midi select"),
        React.createElement("button", { key: "tag", onClick: () => getCallback(props, "onTagBadgeClick")({ id: 2 }) }, "midi tag"),
        React.createElement("button", { key: "filter", onClick: () => getCallback(props, "onTagFilterChange")(3) }, "midi filter"),
        React.createElement("button", { key: "trash", onClick: () => getCallback(props, "onTrashMidi")(2) }, "midi trash"),
        React.createElement("button", { key: "more", onClick: () => getCallback(props, "onLoadMore")() }, "midi more"),
        React.createElement("button", { key: "prev", onClick: () => getCallback(props, "onLoadPrevious")() }, "midi prev"),
        React.createElement("button", { key: "import", onClick: () => getCallback(props, "onImportPaths")(["/drop.mid"]) }, "midi import"),
        React.createElement("button", { key: "search", onClick: () => getCallback(props, "onMidiSearchChange")("piano") }, "midi search"),
        React.createElement("button", { key: "play", onClick: () => getCallback(props, "onTogglePlayback")() }, "midi play"),
      ]);
    }),
    DetailPanel: (props: Record<string, unknown>) => {
      const children: React.ReactNode[] = [
        React.createElement("button", { key: "select", onClick: () => getCallback(props, "onSelect")({ id: 1 }) }, "detail select"),
        React.createElement("button", { key: "filter", onClick: () => getCallback(props, "onFilterChange")({ filterKey: "C" }) }, "detail filter"),
        React.createElement("button", { key: "error", onClick: () => getCallback(props, "onError")("detail failed") }, "detail error"),
      ];
      if (typeof props.onClose === "function") {
        children.push(React.createElement("button", { key: "close", onClick: () => getCallback(props, "onClose")() }, "detail close"));
      }
      return React.createElement("div", { "data-testid": "detail-panel" }, children);
    },
    MidiDetailPanel: (props: Record<string, unknown>) => {
      const children: React.ReactNode[] = [
        React.createElement("button", { key: "filter", onClick: () => getCallback(props, "onTagFilterChange")(4) }, "midi detail filter"),
        React.createElement("button", { key: "manage", onClick: () => getCallback(props, "onManageTags")() }, "midi detail manage"),
        React.createElement("button", { key: "play", onClick: () => getCallback(props, "onTogglePlay")() }, "midi detail play"),
      ];
      if (typeof props.onClose === "function") {
        children.push(React.createElement("button", { key: "close", onClick: () => getCallback(props, "onClose")() }, "midi detail close"));
      }
      return React.createElement("div", { "data-testid": "midi-detail-panel" }, children);
    },
  };
});

const sample: Sample = {
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
  quality_flags: [],
};

const midi: Midi = {
  id: 2,
  file_name: "beat.mid",
  path: "/library/beat.mid",
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
  tag_name: "",
};

function renderPane(overrides: {
  viewMode?: "sample" | "midi";
  selectedSample?: Sample | null;
  selectedMidi?: Midi | null;
  sampleDirectoryPath?: string;
  midiDirectoryPath?: string;
  isMidiPlaying?: boolean;
  directoryClickFiltering?: boolean;
} = {}) {
  const uiState = {
    viewMode: overrides.viewMode ?? "sample",
    isResizing: false,
    handleMouseDown: vi.fn(),
    sidebarWidth: 240,
    isDragOver: false,
  } as unknown as ReturnType<typeof useUIState>;

  const scanState = {
    handleSidebarImport: vi.fn(),
    handleImportPaths: vi.fn(),
    setError: vi.fn(),
  } as unknown as ReturnType<typeof useScanState>;

  const sampleState = {
    scannedPaths: ["/library/kick.wav"],
    allSamplePaths: ["/library/kick.wav"],
    selected: overrides.selectedSample ?? null,
    samplePaths: { 1: "/library/kick.wav" },
    filters: { directoryPath: overrides.sampleDirectoryPath ?? "", favoritesOnly: false, filterKey: "", filterLicense: "", qualityIssuesOnly: false },
    handleFilterChange: vi.fn(),
    suppressNextSearch: vi.fn(),
    loadSampleByPath: vi.fn(),
    setSelected: vi.fn(),
    samples: [sample],
    sort: { field: "id", direction: "asc" },
    setSort: vi.fn(),
    handleDeleteSample: vi.fn(),
    requestTrash: vi.fn(),
    handleTypeClick: vi.fn(),
    loadMore: vi.fn(),
    isLoadingMore: false,
    lastFetchCount: 50,
    loadPrevious: vi.fn(),
    isLoadingPrevious: false,
    canLoadPrevious: true,
    togglePlayback: vi.fn(),
    instrumentTypes: [{ id: 1, name: "kick", created_at: "" }],
  } as unknown as ReturnType<typeof useSampleState>;

  const midiState = {
    midiScannedPaths: ["/library/beat.mid"],
    allMidiPaths: ["/library/kick.wav"],
    selectedMidi: overrides.selectedMidi ?? null,
    selectedMidiIds: new Set<number>(overrides.selectedMidi ? [overrides.selectedMidi.id] : []),
    directoryPath: overrides.midiDirectoryPath ?? "",
    suppressNextMidiSearch: vi.fn(),
    setDirectoryPath: vi.fn(),
    loadMidiByPath: vi.fn(),
    isMidiPlaying: overrides.isMidiPlaying ?? false,
    togglePlaySelectedMidi: vi.fn(),
    setSelectedMidi: vi.fn(),
    setMidiTagEditTargetIds: vi.fn(),
    handleMidiSelect: vi.fn(),
    setMidiTagEditTarget: vi.fn(),
    setMidiTagEditOpen: vi.fn(),
    midiTags: [{ id: 3, name: "drums", created_at: "" }],
    setMidiTagFilterId: vi.fn(),
    midiTagFilterId: null,
    requestTrashMidi: vi.fn(),
    loadMoreMidi: vi.fn(),
    isLoadingMoreMidi: false,
    lastFetchCountMidi: null,
    loadPreviousMidi: vi.fn(),
    isLoadingPreviousMidi: false,
    canLoadPreviousMidi: true,
    midiSearch: "",
    setMidiSearch: vi.fn(),
    setMidiTagModalOpen: vi.fn(),
    _timidityStatus: { installed: true, install_command: "" },
  } as unknown as ReturnType<typeof useMidiState>;

  const playerBarRef = { current: { stop: vi.fn() } as unknown as PlayerBarHandle };

  const handleSampleSelectWithRecent = vi.fn();
  const { container } = render(
    <AppMainPane
      uiState={uiState}
      scanState={scanState}
      sampleState={sampleState}
      midiState={midiState}
      playerBarRef={playerBarRef}
      sampleListRef={createRef<SampleListHandle>()}
      midiListRef={createRef<MidiListHandle>()}
      displayedSamples={[sample]}
      filteredMidis={[midi]}
      instrumentColorCoding={true}
      directoryClickFiltering={overrides.directoryClickFiltering ?? true}
      handleSampleSelectWithRecent={handleSampleSelectWithRecent}
    />
  );

  return { uiState, scanState, sampleState, midiState, playerBarRef, handleSampleSelectWithRecent, container };
}

describe("AppMainPane", () => {
  test("routes sample sidebar file and directory selections", () => {
    const { uiState, sampleState, scanState, playerBarRef, handleSampleSelectWithRecent } = renderPane({ sampleDirectoryPath: "/library" });

    fireEvent.click(screen.getByText("filter file"));
    expect(sampleState.suppressNextSearch).toHaveBeenCalledTimes(1);
    expect(sampleState.handleFilterChange).toHaveBeenCalledWith({ directoryPath: "" });
    expect(sampleState.loadSampleByPath).toHaveBeenCalledWith("/library/kick.wav");

    fireEvent.click(screen.getByText("filter dir"));
    expect(playerBarRef.current?.stop).toHaveBeenCalledTimes(1);
    expect(sampleState.setSelected).toHaveBeenCalledWith(null);
    expect(sampleState.handleFilterChange).toHaveBeenCalledWith({ directoryPath: "/library/drums" });

    fireEvent.click(screen.getByText("sidebar import"));
    expect(scanState.handleSidebarImport).toHaveBeenCalledWith(["/drop.wav"]);

    fireEvent.click(screen.getByText("sidebar sample"));
    expect(handleSampleSelectWithRecent).toHaveBeenCalledWith({ id: 1 });

    fireEvent.click(screen.getByText("sidebar clear"));
    expect(sampleState.handleFilterChange).toHaveBeenCalledWith({ directoryPath: "" });

    const resizeHandle = screen.getByTestId("filter-sidebar").nextElementSibling as HTMLElement;
    fireEvent.mouseDown(resizeHandle);
    expect(uiState.handleMouseDown).toHaveBeenCalledTimes(1);
    fireEvent.mouseEnter(resizeHandle);
    expect(resizeHandle.style.background).toBe("rgb(55, 65, 81)");
    fireEvent.mouseLeave(resizeHandle);
    expect(resizeHandle.style.background).toBe("rgb(31, 41, 55)");
  });

  test("does not route sample sidebar directory selections when directoryClickFiltering is false", () => {
    const { sampleState, playerBarRef } = renderPane({ directoryClickFiltering: false });
    fireEvent.click(screen.getByText("filter dir"));
    expect(playerBarRef.current?.stop).not.toHaveBeenCalled();
    expect(sampleState.setSelected).not.toHaveBeenCalled();
    expect(sampleState.handleFilterChange).not.toHaveBeenCalled();
  });

  test("wires sample list and detail actions", () => {
    const { sampleState, scanState, handleSampleSelectWithRecent } = renderPane({ selectedSample: sample });

    fireEvent.click(screen.getByText("sample filter"));
    expect(sampleState.handleFilterChange).toHaveBeenCalledWith({ search: "kick" });
    fireEvent.click(screen.getByText("sample sort"));
    expect(sampleState.setSort).toHaveBeenCalledWith({ field: "bpm", direction: "desc" });
    fireEvent.click(screen.getByText("sample delete"));
    expect(sampleState.handleDeleteSample).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByText("sample trash"));
    expect(sampleState.requestTrash).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByText("sample type"));
    expect(sampleState.handleTypeClick).toHaveBeenCalledWith({ id: 1 });
    fireEvent.click(screen.getByText("sample import"));
    expect(scanState.handleImportPaths).toHaveBeenCalledWith(["/drop.wav"]);
    fireEvent.click(screen.getByText("sample more"));
    expect(sampleState.loadMore).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText("sample prev"));
    expect(sampleState.loadPrevious).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText("sample play"));
    expect(sampleState.togglePlayback).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText("detail error"));
    expect(scanState.setError).toHaveBeenCalledWith("detail failed");
    fireEvent.click(screen.getByText("detail select"));
    expect(handleSampleSelectWithRecent).toHaveBeenCalledWith({ id: 1 });
  });

  test("routes midi sidebar selections and detail actions", () => {
    const { midiState } = renderPane({ viewMode: "midi", selectedMidi: midi, midiDirectoryPath: "/library", isMidiPlaying: true });

    fireEvent.click(screen.getByText("filter file"));
    expect(midiState.suppressNextMidiSearch).toHaveBeenCalledTimes(1);
    expect(midiState.setDirectoryPath).toHaveBeenCalledWith("");
    expect(midiState.loadMidiByPath).toHaveBeenCalledWith("/library/kick.wav", "");

    fireEvent.click(screen.getByText("filter dir"));
    expect(midiState.togglePlaySelectedMidi).toHaveBeenCalledTimes(1);
    expect(midiState.setSelectedMidi).toHaveBeenCalledWith(null);
    expect(midiState.setDirectoryPath).toHaveBeenCalledWith("/library/drums");

    fireEvent.click(screen.getByText("sidebar clear"));
    expect(midiState.setDirectoryPath).toHaveBeenCalledWith("");

    fireEvent.click(screen.getByText("midi detail filter"));
    expect(midiState.setMidiTagFilterId).toHaveBeenCalledWith(4);
    fireEvent.click(screen.getByText("midi detail manage"));
    expect(midiState.setMidiTagModalOpen).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByText("midi detail play"));
    expect(midiState.togglePlaySelectedMidi).toHaveBeenCalledTimes(2);
  });

  test("does not route midi sidebar directory selections when directoryClickFiltering is false", () => {
    const { midiState } = renderPane({ viewMode: "midi", isMidiPlaying: true, directoryClickFiltering: false });
    fireEvent.click(screen.getByText("filter dir"));
    expect(midiState.togglePlaySelectedMidi).not.toHaveBeenCalled();
    expect(midiState.setSelectedMidi).not.toHaveBeenCalled();
    expect(midiState.setDirectoryPath).not.toHaveBeenCalled();
  });

  test("wires midi list actions", () => {
    const { midiState, scanState } = renderPane({ viewMode: "midi" });

    fireEvent.click(screen.getByText("midi select"));
    expect(midiState.handleMidiSelect).toHaveBeenCalledWith({ id: 2 });
    fireEvent.click(screen.getByText("midi tag"));
    expect(midiState.setMidiTagEditTarget).toHaveBeenCalledWith({ id: 2 });
    expect(midiState.setMidiTagEditOpen).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByText("midi filter"));
    expect(midiState.setMidiTagFilterId).toHaveBeenCalledWith(3);
    fireEvent.click(screen.getByText("midi trash"));
    expect(midiState.requestTrashMidi).toHaveBeenCalledWith(2);
    fireEvent.click(screen.getByText("midi more"));
    expect(midiState.loadMoreMidi).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText("midi prev"));
    expect(midiState.loadPreviousMidi).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText("midi import"));
    expect(scanState.handleImportPaths).toHaveBeenCalledWith(["/drop.mid"]);
    fireEvent.click(screen.getByText("midi search"));
    expect(midiState.setMidiSearch).toHaveBeenCalledWith("piano");
    fireEvent.click(screen.getByText("midi play"));
    expect(midiState.togglePlaySelectedMidi).toHaveBeenCalledTimes(1);
  });

  test("calls sample close logic correctly", () => {
    const { sampleState, playerBarRef } = renderPane({ selectedSample: sample });
    fireEvent.click(screen.getByText("detail close"));
    expect(sampleState.setSelected).toHaveBeenCalledWith(null);
    expect(playerBarRef.current?.stop).toHaveBeenCalled();
  });

  test("calls midi close logic correctly when not playing", () => {
    const { midiState } = renderPane({ viewMode: "midi", selectedMidi: midi, isMidiPlaying: false });
    fireEvent.click(screen.getByText("midi detail close"));
    expect(midiState.setSelectedMidi).toHaveBeenCalledWith(null);
    expect(midiState.togglePlaySelectedMidi).not.toHaveBeenCalled();
  });

  test("calls midi close logic correctly when playing", () => {
    const { midiState } = renderPane({ viewMode: "midi", selectedMidi: midi, isMidiPlaying: true });
    fireEvent.click(screen.getByText("midi detail close"));
    expect(midiState.setSelectedMidi).toHaveBeenCalledWith(null);
    expect(midiState.togglePlaySelectedMidi).toHaveBeenCalledTimes(1);
  });
});
