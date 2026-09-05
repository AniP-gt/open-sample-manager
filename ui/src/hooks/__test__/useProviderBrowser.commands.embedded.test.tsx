import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderProviderBrowser } from "./providerBrowserTestHarness";

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(() => Promise.resolve(vi.fn())) }));

describe("useProviderBrowser embedded commands", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockResolvedValue(undefined);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  it("opens, closes, reopens, resizes, and clears an embedded provider", async () => {
    const resizeObserver = { callback: null as ResizeObserverCallback | null };
    class TestResizeObserver {
      constructor(callback: ResizeObserverCallback) { resizeObserver.callback = callback; }
      observe() {}
      disconnect() {}
      unobserve() {}
    }
    vi.stubGlobal("ResizeObserver", TestResizeObserver);
    const { result, rerender } = renderProviderBrowser({
      attachViewport: true,
      initialProps: { mode: "embedded", viewMode: "web" },
    });

    await act(async () => { await result.current.selectProvider("music_radar"); });
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("open_provider_browser", {
      provider: "music_radar",
      mode: "embedded",
      downloadRoot: "/Users/alice/Downloads",
      bounds: { x: 12, y: 24, width: 640, height: 480 },
    }));
    rerender({ mode: "embedded", viewMode: "sample" });
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("close_embedded_provider_browser", { provider: "music_radar" }));

    rerender({ mode: "embedded", viewMode: "web" });
    await waitFor(() => expect(invokeMock.mock.calls.filter(([command]) => command === "open_provider_browser")).toHaveLength(2));
    expect(invokeMock).not.toHaveBeenCalledWith("show_provider_browser", { provider: "music_radar" });
    resizeObserver.callback?.([], {} as ResizeObserver);
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("set_provider_browser_bounds", {
      provider: "music_radar",
      bounds: { x: 12, y: 24, width: 640, height: 480 },
    }));

    await act(async () => { await result.current.clearActiveProvider(); });
    expect(result.current.activeProvider).toBeNull();
    expect(invokeMock).toHaveBeenCalledWith("close_embedded_provider_browser", { provider: "music_radar" });
  });

  it("keeps an opened embedded provider active when bounds reconciliation fails", async () => {
    const resizeObserver = { callback: null as ResizeObserverCallback | null };
    class TestResizeObserver {
      constructor(callback: ResizeObserverCallback) { resizeObserver.callback = callback; }
      observe() {}
      disconnect() {}
      unobserve() {}
    }
    vi.stubGlobal("ResizeObserver", TestResizeObserver);
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    const setError = vi.fn<(message: string | null) => void>();
    let resolveOpen: (value: unknown) => void = () => undefined;
    const open = new Promise<unknown>((resolve) => { resolveOpen = resolve; });
    invokeMock.mockImplementation((command) => command === "open_provider_browser" ? open : Promise.resolve(undefined));
    const { result } = renderProviderBrowser({
      attachViewport: true,
      downloadRoot: null,
      initialProps: { mode: "embedded", viewMode: "web" },
      setError,
    });

    await act(async () => { await result.current.selectProvider("music_radar"); });
    await act(async () => { frames.splice(0).forEach((callback) => callback(0)); });
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("open_provider_browser", expect.objectContaining({
      provider: "music_radar",
      mode: "embedded",
    })));
    await act(async () => { resolveOpen(undefined); await open; });
    await waitFor(() => expect(result.current.status).toBeNull());
    await waitFor(() => expect(resizeObserver.callback).not.toBeNull());
    setError.mockClear();
    invokeMock.mockImplementation((command) => command === "set_provider_browser_bounds"
      ? Promise.reject({ code: "provider_surface_unavailable", details: "do not expose this" })
      : Promise.resolve(undefined));

    await act(async () => { resizeObserver.callback?.([], {} as ResizeObserver); });
    await act(async () => { frames.splice(0).forEach((callback) => callback(0)); });
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("set_provider_browser_bounds", expect.anything()));
    expect(result.current.activeProvider).toBe("music_radar");
    expect(setError).not.toHaveBeenCalledWith(expect.stringContaining("Provider browser could not be opened"));

    invokeMock.mockResolvedValue(undefined);
    await act(async () => {
      resizeObserver.callback?.([], {} as ResizeObserver);
      frames.splice(0).forEach((callback) => callback(0));
    });
    await waitFor(() => expect(invokeMock.mock.calls.filter(([command]) => command === "set_provider_browser_bounds")).toHaveLength(2));
  });

  it("clears embedded ownership before accepting a separate-window mode change", async () => {
    const { result } = renderProviderBrowser({
      attachViewport: true,
      downloadRoot: null,
      initialProps: { mode: "embedded", viewMode: "web" },
    });
    await act(async () => { await result.current.selectProvider("music_radar"); });
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("open_provider_browser", expect.objectContaining({
      provider: "music_radar",
      mode: "embedded",
    })));

    await act(async () => { await expect(result.current.changeMode("window")).resolves.toBe("window"); });

    const embeddedClose = invokeMock.mock.calls.findIndex(([command]) => command === "close_embedded_provider_browser");
    const allClose = invokeMock.mock.calls.findIndex(([command]) => command === "close_all_provider_browsers");
    expect(embeddedClose).toBeLessThan(allClose);
    expect(result.current.activeProvider).toBeNull();
    expect(result.current.status).toBeNull();
  });
});
