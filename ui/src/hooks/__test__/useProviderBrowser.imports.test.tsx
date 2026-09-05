import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProviderBrowser } from "../useProviderBrowser";

type MockEvent = { readonly payload: unknown };

const eventMocks = vi.hoisted(() => ({
  listeners: new Map<string, (event: MockEvent) => void>(),
  unlistenReady: vi.fn(),
  unlistenFailed: vi.fn(),
}));

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn((event: string, handler: (event: MockEvent) => void) => {
    eventMocks.listeners.set(event, handler);
    const unlisten = event === "provider-import-ready"
      ? eventMocks.unlistenReady
      : eventMocks.unlistenFailed;
    return Promise.resolve(unlisten);
  }),
}));

describe("useProviderBrowser provider imports", () => {
  beforeEach(() => {
    eventMocks.listeners.clear();
    eventMocks.unlistenReady.mockReset();
    eventMocks.unlistenFailed.mockReset();
    invokeMock.mockReset();
    invokeMock.mockResolvedValue(undefined);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  it("queues provider scans, clears status, and cleans up listeners", async () => {
    let resolveScan: () => void = () => {};
    const secondScan = new Promise<void>((resolve) => {
      resolveScan = resolve;
    });
    const performScan = vi.fn<() => Promise<void>>()
      .mockResolvedValueOnce(undefined)
      .mockReturnValueOnce(secondScan);
    const { result, unmount } = renderHook(() => useProviderBrowser({
      downloadRoot: null,
      mode: "window",
      settingsOpen: false,
      viewMode: "sample",
      performScan,
      setError: vi.fn<(message: string | null) => void>(),
    }));

    await waitFor(() => expect(eventMocks.listeners.size).toBe(2));
    const readyListener = eventMocks.listeners.get("provider-import-ready");
    act(() => {
      readyListener?.({ payload: { provider: "music_radar", directory: "/imports/musicradar" } });
      readyListener?.({ payload: { provider: "fifty_sounds", directory: "/imports/fifty" } });
    });

    await waitFor(() => expect(performScan).toHaveBeenCalledTimes(2));
    expect(performScan).toHaveBeenCalledWith("/imports/musicradar");
    expect(performScan).toHaveBeenLastCalledWith("/imports/fifty");

    await act(async () => {
      resolveScan();
      await secondScan;
    });
    await waitFor(() => expect(result.current.status).toBeNull());
    unmount();

    expect(eventMocks.unlistenReady).toHaveBeenCalledTimes(1);
    expect(eventMocks.unlistenFailed).toHaveBeenCalledTimes(1);
  });

  it("queues repeated ready events for the same root until each scan completes", async () => {
    let resolveFirstScan: () => void = () => {};
    const firstScan = new Promise<void>((resolve) => {
      resolveFirstScan = resolve;
    });
    let resolveSecondScan: () => void = () => {};
    const secondScan = new Promise<void>((resolve) => {
      resolveSecondScan = resolve;
    });
    const performScan = vi.fn<() => Promise<void>>()
      .mockReturnValueOnce(firstScan)
      .mockReturnValueOnce(secondScan);
    const { result } = renderHook(() => useProviderBrowser({
      downloadRoot: null,
      mode: "window",
      settingsOpen: false,
      viewMode: "sample",
      performScan,
      setError: vi.fn<(message: string | null) => void>(),
    }));

    await waitFor(() => expect(eventMocks.listeners.size).toBe(2));
    const readyListener = eventMocks.listeners.get("provider-import-ready");
    act(() => {
      readyListener?.({ payload: { provider: "music_radar", directory: "/imports/musicradar" } });
      readyListener?.({ payload: { provider: "music_radar", directory: "/imports/musicradar" } });
    });

    await waitFor(() => expect(performScan).toHaveBeenCalledTimes(1));
    expect(performScan).toHaveBeenLastCalledWith("/imports/musicradar");
    await act(async () => {
      resolveFirstScan();
      await firstScan;
    });
    await waitFor(() => expect(performScan).toHaveBeenCalledTimes(2));
    expect(result.current.status).toBe("SCANNING music_radar IMPORT");

    await act(async () => {
      resolveSecondScan();
      await secondScan;
    });
    await waitFor(() => expect(result.current.status).toBeNull());
  });

  it("passes the selected download root from provider-import-ready to performScan once", async () => {
    const selectedDownloadRoot = "fixture/download-root";
    const performScan = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    renderHook(() => useProviderBrowser({
      downloadRoot: selectedDownloadRoot,
      mode: "window",
      settingsOpen: false,
      viewMode: "sample",
      performScan,
      setError: vi.fn<(message: string | null) => void>(),
    }));

    await waitFor(() => expect(eventMocks.listeners.size).toBe(2));
    const readyListener = eventMocks.listeners.get("provider-import-ready");
    act(() => {
      readyListener?.({
        payload: { provider: "music_radar", directory: selectedDownloadRoot },
      });
    });

    await waitFor(() => expect(performScan).toHaveBeenCalledTimes(1));
    expect(performScan).toHaveBeenCalledWith(selectedDownloadRoot);
  });

  it("reports a safe failure code", async () => {
    const setError = vi.fn<(message: string | null) => void>();
    renderHook(() => useProviderBrowser({
      downloadRoot: null,
      mode: "window",
      settingsOpen: false,
      viewMode: "sample",
      performScan: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
      setError,
    }));

    await waitFor(() => expect(eventMocks.listeners.size).toBe(2));
    const failedListener = eventMocks.listeners.get("provider-import-failed");
    failedListener?.({ payload: { provider: "music_radar", code: "download_denied" } });

    expect(setError).toHaveBeenCalledWith("Provider import failed (download_denied).");
  });

  it("continues queued scans after a scan rejection", async () => {
    const setError = vi.fn<(message: string | null) => void>();
    const performScan = vi.fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error("scan failed"))
      .mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useProviderBrowser({
      downloadRoot: null,
      mode: "window",
      settingsOpen: false,
      viewMode: "sample",
      performScan,
      setError,
    }));

    await waitFor(() => expect(eventMocks.listeners.size).toBe(2));
    const readyListener = eventMocks.listeners.get("provider-import-ready");
    act(() => {
      readyListener?.({ payload: { provider: "music_radar", directory: "/imports/failed" } });
      readyListener?.({ payload: { provider: "fifty_sounds", directory: "/imports/next" } });
    });

    await waitFor(() => expect(performScan).toHaveBeenCalledTimes(2));
    expect(performScan).toHaveBeenNthCalledWith(1, "/imports/failed");
    expect(performScan).toHaveBeenNthCalledWith(2, "/imports/next");
    expect(setError).toHaveBeenCalledWith("Could not scan a provider import.");
    await waitFor(() => expect(result.current.status).toBeNull());
  });
});
