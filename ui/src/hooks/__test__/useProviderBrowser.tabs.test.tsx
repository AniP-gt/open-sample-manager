import { StrictMode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProviderBrowserMode } from "../../types/provider";
import type { ViewMode } from "../../types/viewMode";
import { useProviderBrowser } from "../useProviderBrowser";

type BrowserProps = { readonly mode: ProviderBrowserMode; readonly settingsOpen?: boolean; readonly viewMode: ViewMode };
type Deferred<T> = { readonly promise: Promise<T>; readonly reject: (reason?: unknown) => void; readonly resolve: (value: T) => void };
const eventMocks = vi.hoisted(() => ({ unlisten: vi.fn() }));
const invokeMock = vi.hoisted(() => vi.fn<(command: string, payload?: { readonly provider: string }) => Promise<unknown>>());

vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(() => Promise.resolve(eventMocks.unlisten)) }));

function deferred<T>(): Deferred<T> {
  let rejectPromise: (reason?: unknown) => void = () => undefined;
  let resolvePromise: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolve, reject) => { resolvePromise = resolve; rejectPromise = reject; });
  return { promise, reject: rejectPromise, resolve: resolvePromise };
}

function renderBrowser(initialProps: BrowserProps) {
  const viewport = document.createElement("div"); vi.spyOn(viewport, "getBoundingClientRect").mockReturnValue(new DOMRect(12, 24, 640, 480));
  const rendered = renderHook<ReturnType<typeof useProviderBrowser>, BrowserProps>(
    ({ mode, settingsOpen = false, viewMode }) => useProviderBrowser({ downloadRoot: "/Users/alice/Downloads", mode, settingsOpen, viewMode, performScan: vi.fn<() => Promise<void>>().mockResolvedValue(undefined), setError: vi.fn<(message: string | null) => void>() }),
    { initialProps, wrapper: StrictMode },
  );
  act(() => rendered.result.current.viewportRef(viewport)); return rendered;
}

describe("useProviderBrowser embedded tab lifecycle", () => {
  beforeEach(() => {
    eventMocks.unlisten.mockReset();
    invokeMock.mockReset();
    invokeMock.mockResolvedValue(undefined);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 1; });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  it("closes an embedded provider while SAMPLE and MIDI replace WEB", async () => {
    // Given: MUSICRADAR is visible in the WEB tab.
    invokeMock.mockImplementation((command) => command === "close_embedded_provider_browser"
      ? Promise.resolve("https://www.musicradar.com/samples/tabs-test")
      : Promise.resolve(undefined));
    const { result, rerender } = renderBrowser({ mode: "embedded", viewMode: "web" });
    await act(async () => { await result.current.selectProvider("music_radar"); });
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("open_provider_browser", expect.anything()));

    // When: the user changes from WEB to SAMPLE and then MIDI.
    rerender({ mode: "embedded", viewMode: "sample" });
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("close_embedded_provider_browser", { provider: "music_radar" }));
    rerender({ mode: "embedded", viewMode: "midi" });

    // Then: the selected provider is retained after its native child is destroyed.
    expect(invokeMock.mock.calls.filter(([command]) => command === "close_embedded_provider_browser")).toHaveLength(1);
    expect(invokeMock).not.toHaveBeenCalledWith("hide_provider_browser", expect.anything());
    expect(result.current.activeProvider).toBe("music_radar");
  });

  it("reopens an embedded provider at its captured URL when WEB returns", async () => {
    invokeMock.mockImplementation((command) => command === "close_embedded_provider_browser"
      ? Promise.resolve("https://www.musicradar.com/samples/return-test")
      : Promise.resolve(undefined));
    const { result, rerender } = renderBrowser({ mode: "embedded", viewMode: "web" });
    await act(async () => { await result.current.selectProvider("music_radar"); });
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("open_provider_browser", expect.anything()));
    rerender({ mode: "embedded", viewMode: "sample" });
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("close_embedded_provider_browser", { provider: "music_radar" }));

    // When: the user returns to WEB.
    rerender({ mode: "embedded", viewMode: "web" });

    // Then: a recreated child receives the captured approved URL.
    await waitFor(() => expect(invokeMock).toHaveBeenLastCalledWith("open_provider_browser", expect.objectContaining({
      provider: "music_radar",
      mode: "embedded",
      url: "https://www.musicradar.com/samples/return-test",
    })));
    expect(invokeMock.mock.calls.filter(([command]) => command === "open_provider_browser")).toHaveLength(2);
  });

  it("closes a child opened after switching away before it can float", async () => {
    // Given: opening an embedded provider is still in flight.
    const opening = deferred<void>();
    invokeMock.mockImplementation((command) => command === "open_provider_browser" ? opening.promise : Promise.resolve(undefined));
    const { result, rerender } = renderBrowser({ mode: "embedded", viewMode: "web" });
    act(() => { void result.current.selectProvider("music_radar"); });
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("open_provider_browser", expect.anything()));

    // When: SAMPLE is selected before the native child finishes opening.
    rerender({ mode: "embedded", viewMode: "sample" });
    await act(async () => { opening.resolve(); await opening.promise; });

    // Then: the late child is closed and WEB recreates it.
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("close_embedded_provider_browser", { provider: "music_radar" }));
    rerender({ mode: "embedded", viewMode: "web" });
    await waitFor(() => expect(invokeMock.mock.calls.filter(([command]) => command === "open_provider_browser")).toHaveLength(2));
  });

  it("retries an embedded open after a stale rejection", async () => {
    // Given: the first embedded open is still in flight.
    const opening = deferred<void>();
    let openCount = 0;
    invokeMock.mockImplementation((command) => {
      if (command !== "open_provider_browser") return Promise.resolve(undefined);
      openCount += 1;
      return openCount === 1 ? opening.promise : Promise.resolve(undefined);
    });
    const { result, rerender } = renderBrowser({ mode: "embedded", viewMode: "web" });
    act(() => { void result.current.selectProvider("music_radar"); });
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("open_provider_browser", expect.anything()));

    // When: the user moves away, returns to WEB, and the first native open rejects.
    rerender({ mode: "embedded", viewMode: "sample" });
    rerender({ mode: "embedded", viewMode: "web" });
    await act(async () => { opening.reject(new Error("open failed")); });
    rerender({ mode: "embedded", viewMode: "sample" });
    rerender({ mode: "embedded", viewMode: "web" });

    // Then: the stale guard is released and WEB can retry the open.
    await waitFor(() => expect(invokeMock.mock.calls.filter(([command]) => command === "open_provider_browser")).toHaveLength(2));
    expect(result.current.activeProvider).toBe("music_radar");
    expect(result.current.status).toBeNull();
  });

});
