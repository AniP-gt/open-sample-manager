import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProviderBrowser } from "../useProviderBrowser";
import type { ProviderBrowserMode } from "../../types/provider";
import type { ViewMode } from "../../types/viewMode";

type HookProps = {
  readonly mode: ProviderBrowserMode;
  readonly settingsOpen: boolean;
  readonly viewMode: ViewMode;
};

const invokeMock = vi.hoisted(() => vi.fn());
const eventMocks = vi.hoisted(() => ({
  listeners: new Map<string, (event: { readonly payload: unknown }) => void>(),
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn((event: string, handler: (event: { readonly payload: unknown }) => void) => {
    eventMocks.listeners.set(event, handler);
    return Promise.resolve(vi.fn());
  }),
}));

describe("useProviderBrowser lifecycle", () => {
  let frames: FrameRequestCallback[];

  beforeEach(() => {
    frames = [];
    eventMocks.listeners.clear();
    invokeMock.mockReset();
    invokeMock.mockResolvedValue(undefined);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.stubGlobal("ResizeObserver", class {
      observe() {}
      disconnect() {}
      unobserve() {}
    });
  });

  function renderBrowser(initialProps: HookProps = { mode: "embedded", settingsOpen: false, viewMode: "web" }) {
    const viewport = document.createElement("div");
    vi.spyOn(viewport, "getBoundingClientRect").mockReturnValue(new DOMRect(12, 24, 640, 480));
    const hook = renderHook<ReturnType<typeof useProviderBrowser>, HookProps>((props) => useProviderBrowser({
      downloadRoot: "/Users/alice/Downloads",
      mode: props.mode,
      settingsOpen: props.settingsOpen,
      viewMode: props.viewMode,
      performScan: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
      setError: vi.fn<(message: string | null) => void>(),
    }), { initialProps });
    act(() => hook.result.current.viewportRef(viewport));
    return hook;
  }

  async function flushFrames() {
    const queued = frames;
    frames = [];
    await act(async () => {
      queued.forEach((callback) => callback(0));
    });
  }

  it("settles an embedded browser after its open invoke succeeds without a readiness event", async () => {
    const hook = renderBrowser();

    await act(async () => { await hook.result.current.selectProvider("music_radar"); });
    await flushFrames();

    expect(invokeMock).toHaveBeenCalledWith("open_provider_browser", expect.objectContaining({
      provider: "music_radar",
      mode: "embedded",
    }));
    expect(eventMocks.listeners.has("provider-browser-ready")).toBe(false);
    expect(eventMocks.listeners.has("provider-browser-failed")).toBe(false);
    await waitFor(() => expect(hook.result.current.status).toBeNull());
  });

  it("closes an embedded browser and retains its approved URL after its open invoke succeeds", async () => {
    const { result, rerender } = renderBrowser();
    invokeMock.mockImplementation((command) => command === "close_embedded_provider_browser"
      ? Promise.resolve("https://www.musicradar.com/samples/lifecycle-test")
      : Promise.resolve(undefined));

    await act(async () => { await result.current.selectProvider("music_radar"); });
    await flushFrames();
    await waitFor(() => expect(result.current.status).toBeNull());
    rerender({ mode: "embedded", settingsOpen: false, viewMode: "sample" });

    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("close_embedded_provider_browser", { provider: "music_radar" }));
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("close_all_provider_browsers"));
    const providerClose = invokeMock.mock.calls.findIndex(([command]) => command === "close_embedded_provider_browser");
    const allProvidersClose = invokeMock.mock.calls.findIndex(([command]) => command === "close_all_provider_browsers");
    expect(providerClose).toBeLessThan(allProvidersClose);
    expect(result.current.activeProvider).toBe("music_radar");
    expect(invokeMock).not.toHaveBeenCalledWith("hide_provider_browser", { provider: "music_radar" });

    rerender({ mode: "embedded", settingsOpen: false, viewMode: "midi" });
    expect(invokeMock.mock.calls.filter(([command]) => command === "close_embedded_provider_browser")).toHaveLength(1);

    rerender({ mode: "embedded", settingsOpen: false, viewMode: "web" });
    await flushFrames();
    await waitFor(() => expect(invokeMock).toHaveBeenLastCalledWith("open_provider_browser", expect.objectContaining({
      provider: "music_radar",
      mode: "embedded",
      url: "https://www.musicradar.com/samples/lifecycle-test",
    })));
  });

  it("does not reconcile an embedded provider after departure close begins", async () => {
    const observers: TestResizeObserver[] = [];
    class TestResizeObserver {
      readonly callback: ResizeObserverCallback;

      constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
        observers.push(this);
      }

      observe() {}
      disconnect() {}
      unobserve() {}

      trigger() {
        this.callback([], this);
      }
    }

    vi.stubGlobal("ResizeObserver", TestResizeObserver);
    let resolveClose: (value: unknown) => void = () => undefined;
    const close = new Promise<unknown>((resolve) => {
      resolveClose = resolve;
    });
    let openAttempts = 0;
    const setError = vi.fn<(message: string | null) => void>();
    invokeMock.mockImplementation((command) => {
      if (command === "close_embedded_provider_browser") return close;
      if (command !== "open_provider_browser") return Promise.resolve(undefined);
      openAttempts += 1;
      return openAttempts === 1
        ? Promise.resolve(undefined)
        : Promise.reject({ code: "provider_surface_unavailable", message: "closing" });
    });
    const viewport = document.createElement("div");
    vi.spyOn(viewport, "getBoundingClientRect").mockReturnValue(new DOMRect(12, 24, 640, 480));
    const hook = renderHook(() => useProviderBrowser({
      downloadRoot: "/Users/alice/Downloads",
      mode: "embedded",
      settingsOpen: false,
      viewMode: "web",
      performScan: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
      setError,
    }));
    act(() => hook.result.current.viewportRef(viewport));
    await act(async () => { await hook.result.current.selectProvider("music_radar"); });
    await flushFrames();
    await waitFor(() => expect(openAttempts).toBe(1));
    setError("Provider browser could not be opened.");
    setError.mockClear();

    const departure = hook.result.current.hideEmbeddedBrowserBeforeLeavingWeb();
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("close_embedded_provider_browser", { provider: "music_radar" }));
    expect(setError).toHaveBeenLastCalledWith(null);
    const observer = observers.at(-1);
    if (!observer) throw new Error("provider viewport observer was not created");
    act(() => observer.trigger());
    await flushFrames();

    await act(async () => {
      resolveClose("https://www.musicradar.com/samples/departure-test");
      await departure;
      await Promise.resolve();
    });

    expect(openAttempts).toBe(1);
    expect(setError).toHaveBeenLastCalledWith(null);
  });

});
