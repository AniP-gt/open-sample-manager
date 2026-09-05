import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProviderBrowserMode } from "../../types/provider";
import { useProviderBrowser } from "../useProviderBrowser";

type BrowserProps = {
  readonly downloadRoot: string;
  readonly mode: ProviderBrowserMode;
};

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(() => Promise.resolve(vi.fn())) }));

describe("useProviderBrowser download root lifecycle", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockResolvedValue(undefined);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.stubGlobal("ResizeObserver", class {
      observe() {}
      disconnect() {}
      unobserve() {}
    });
  });

  function renderBrowser(initialProps: BrowserProps) {
    const viewport = document.createElement("div");
    vi.spyOn(viewport, "getBoundingClientRect").mockReturnValue(new DOMRect(12, 24, 640, 480));
    const hook = renderHook<ReturnType<typeof useProviderBrowser>, BrowserProps>((props) => useProviderBrowser({
      downloadRoot: props.downloadRoot,
      mode: props.mode,
      settingsOpen: false,
      viewMode: "web",
      performScan: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
      setError: vi.fn<(message: string | null) => void>(),
    }), { initialProps });
    act(() => hook.result.current.viewportRef(viewport));
    return hook;
  }

  it.each<ProviderBrowserMode>(["window", "embedded"])("closes root A before opening root B in %s mode", async (mode) => {
    const { result, rerender } = renderBrowser({ downloadRoot: "/roots/A", mode });

    await act(async () => { await result.current.selectProvider("music_radar"); });
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("open_provider_browser", expect.objectContaining({
      downloadRoot: "/roots/A",
      mode,
      provider: "music_radar",
    })));
    invokeMock.mockClear();

    rerender({ downloadRoot: "/roots/B", mode });

    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("close_all_provider_browsers"));
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("open_provider_browser", expect.objectContaining({
      downloadRoot: "/roots/B",
      mode,
      provider: "music_radar",
    })));
    expect(invokeMock.mock.calls.findIndex(([command]) => command === "close_all_provider_browsers")).toBeLessThan(
      invokeMock.mock.calls.findIndex(([command]) => command === "open_provider_browser"),
    );
  });

  it("retains window ownership and reports a safe error when mode-change close fails", async () => {
    const setError = vi.fn<(message: string | null) => void>();
    const { result } = renderHook(() => useProviderBrowser({
      downloadRoot: "/roots/A",
      mode: "window",
      settingsOpen: false,
      viewMode: "web",
      performScan: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
      setError,
    }));
    await act(async () => { await result.current.selectProvider("music_radar"); });
    invokeMock.mockImplementation((command) => command === "close_all_provider_browsers"
      ? Promise.reject(new Error("native close failed"))
      : Promise.resolve(undefined));

    await act(async () => { await expect(result.current.changeMode("embedded")).resolves.toBe(false); });

    expect(result.current.activeProvider).toBe("music_radar");
    expect(setError).toHaveBeenCalledWith("Provider browser could not be closed.");
  });
});
