import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import { stat } from "@tauri-apps/plugin-fs";
import type { FilterState, Sample } from "../../types/sample";
import type { Midi } from "../../types/midi";
import { useScanState } from "../useScanState";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn() }));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
vi.mock("@tauri-apps/plugin-fs", () => ({ stat: vi.fn() }));

type ListenMock = <T>(event: string, handler: (event: { payload: T }) => void) => Promise<() => void>;

const invokeMock = vi.mocked(invoke);
const listenMock = vi.mocked(listen) as unknown as Mock<ListenMock>;
const openMock = vi.mocked(open);
const statMock = vi.mocked(stat);

const filters: FilterState = {
  search: "kick",
  filterType: "all",
  filterBpmMin: "",
  filterBpmMax: "",
  filterInstrumentType: "",
  favoritesOnly: false,
  hideDuplicates: false,
  filterKey: "",
};

const renderScanHook = (overrides: Partial<Parameters<typeof useScanState>[0]> = {}) => {
  const setMidis = vi.fn();
  const setLastFetchCountMidi = vi.fn();
  const setSelected = vi.fn();
  const props: Parameters<typeof useScanState>[0] = {
    getAllSamplePaths: () => [],
    getFilters: () => filters,
    runSearch: vi.fn<() => Promise<Sample[]>>().mockResolvedValue([]),
    fetchAllSamplePaths: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    fetchAllMidiPaths: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    viewMode: "midi",
    pageLimit: 25,
    setMidis,
    setLastFetchCountMidi,
    setSelected,
    getMidiTagFilterId: () => 42,
    ...overrides,
    getMidiDirectoryPath: overrides.getMidiDirectoryPath ?? (() => ""),
  };
  return { ...renderHook(() => useScanState(props)), props, setMidis, setLastFetchCountMidi };
};

describe("useScanState", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    listenMock.mockReset();
    openMock.mockReset();
    statMock.mockReset();
    listenMock.mockResolvedValue(() => undefined);
    invokeMock.mockImplementation(async (command) => {
      if (command === "list_midis_paginated") return [{ id: 1, path: "/m/a.mid" }] as Midi[];
      return 1;
    });
  });

  it("performs sample and MIDI scans then refreshes lists", async () => {
    const { result, props, setMidis, setLastFetchCountMidi } = renderScanHook();

    await act(async () => {
      await result.current.performScan("/samples");
    });

    expect(invokeMock).toHaveBeenCalledWith("scan_directory", { path: "/samples" });
    expect(invokeMock).toHaveBeenCalledWith("scan_midi_directory", { path: "/samples" });
    expect(props.runSearch).toHaveBeenCalledWith("kick");
    expect(props.fetchAllSamplePaths).toHaveBeenCalled();
    expect(props.fetchAllMidiPaths).toHaveBeenCalled();
    const listMidiCalls = invokeMock.mock.calls.filter(([cmd]) => cmd === "list_midis_paginated");
    expect(listMidiCalls.length).toBeGreaterThan(0);
    expect(listMidiCalls[0]?.[1]).toMatchObject({ tagId: 42 });
    expect(setMidis).toHaveBeenCalledWith([{ id: 1, path: "/m/a.mid" }]);
    expect(setLastFetchCountMidi).toHaveBeenCalledWith(1);
    expect(result.current.scanning).toBe(false);
  });

  it("prompts before rescanning when samples already exist", async () => {
    openMock.mockResolvedValue("/samples");
    const { result } = renderScanHook({ getAllSamplePaths: () => ["/old/kick.wav"] });

    await act(async () => {
      await result.current.handleScanClick();
    });

    expect(result.current.rescanPromptOpen).toBe(true);
    expect(result.current.rescanPendingPath).toBe("/samples");
    expect(invokeMock).not.toHaveBeenCalledWith("scan_directory", { path: "/samples" });
  });

  it("imports a dropped MIDI file through the fast path", async () => {
    statMock.mockResolvedValue({ isFile: true, isDirectory: false } as Awaited<ReturnType<typeof stat>>);
    const { result, props } = renderScanHook();

    await act(async () => {
      await result.current.handleImportPaths(["/Users/alice/midis/groove.mid"]);
    });

    expect(invokeMock).toHaveBeenCalledWith("import_file", { path: "/Users/alice/midis/groove.mid" });
    expect(invokeMock).toHaveBeenCalledWith("scan_midi_directory", { path: "/Users/alice/midis" });
    expect(props.runSearch).toHaveBeenCalledWith("kick");
    const listMidiCalls = invokeMock.mock.calls.filter(([cmd]) => cmd === "list_midis_paginated");
    expect(listMidiCalls.length).toBeGreaterThan(0);
    expect(listMidiCalls[0]?.[1]).toMatchObject({ tagId: 42 });
    await waitFor(() => expect(result.current.scanning).toBe(false));
  });

  it("re-scans all samples and records a complete progress message", async () => {
    invokeMock.mockImplementation(async (command) => {
      if (command === "re_scan_all_samples") return 4;
      return 1;
    });
    const { result, props } = renderScanHook({ viewMode: "sample" });

    await act(async () => {
      await result.current.handleReScanClick();
    });

    expect(invokeMock).toHaveBeenCalledWith("re_scan_all_samples");
    expect(props.runSearch).toHaveBeenCalledWith("kick");
    expect(props.fetchAllSamplePaths).toHaveBeenCalled();
    expect(result.current.scanning).toBe(false);
    expect(result.current.scanProgress).toBeNull();
  });

  it("imports directory targets through the multi-path scan flow", async () => {
    statMock.mockResolvedValue({ isFile: false, isDirectory: true } as Awaited<ReturnType<typeof stat>>);
    const { result, props } = renderScanHook({ viewMode: "sample" });

    await act(async () => {
      await result.current.handleImportPaths(["/Users/alice/A", "/Users/alice/B"]);
    });

    expect(invokeMock).toHaveBeenCalledWith("scan_directory", { path: "/Users/alice/A" });
    expect(invokeMock).toHaveBeenCalledWith("scan_directory", { path: "/Users/alice/B" });
    expect(invokeMock).toHaveBeenCalledWith("scan_midi_directory", { path: "/Users/alice/A" });
    expect(props.runSearch).toHaveBeenCalledTimes(2);
    expect(result.current.scanning).toBe(false);
  });

  it("delegates sidebar imports and refreshes MIDI state in MIDI view", async () => {
    const { result, props, setMidis, setLastFetchCountMidi } = renderScanHook();

    await act(async () => {
      await result.current.handleSidebarImport(["/Users/alice/Samples/kick.wav"]);
    });

    expect(invokeMock).toHaveBeenCalledWith("scan_directory", { path: "/Users/alice/Samples" });
    expect(props.fetchAllSamplePaths).toHaveBeenCalled();
    expect(setMidis).toHaveBeenCalledWith([{ id: 1, path: "/m/a.mid" }]);
    expect(setLastFetchCountMidi).toHaveBeenCalledWith(1);
    expect(props.fetchAllMidiPaths).toHaveBeenCalled();
    const listMidiCalls = invokeMock.mock.calls.filter(([cmd]) => cmd === "list_midis_paginated");
    expect(listMidiCalls[0]?.[1]).toMatchObject({ tagId: 42 });
  });

  it("stores invoke errors and retries the saved action", async () => {
    const { result } = renderScanHook();
    const retry = vi.fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error("first failure"))
      .mockResolvedValueOnce(undefined);

    act(() => result.current.setRetryAction(() => retry));

    await act(async () => {
      await result.current.handleRetry();
    });
    expect(result.current.error).toBe("first failure");

    await act(async () => {
      await result.current.handleRetry();
    });
    expect(result.current.error).toBeNull();
    expect(retry).toHaveBeenCalledTimes(2);
  });

  it("reports scan and dialog errors without leaving scanning active", async () => {
    invokeMock.mockImplementation(async (command) => {
      if (command === "scan_directory") throw new Error("scan failed");
      return 1;
    });
    const { result } = renderScanHook();

    await act(async () => {
      await result.current.performScan("/broken");
    });
    expect(result.current.error).toBe("scan failed");
    expect(result.current.scanning).toBe(false);

    openMock.mockRejectedValue(new Error("dialog missing"));
    await act(async () => {
      await result.current.handleScanClick();
    });
    expect(result.current.error).toContain("Dialog not available");
  });
});
