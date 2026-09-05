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

describe("useProviderBrowser embedded tab transitions", () => {
  beforeEach(() => {
    eventMocks.unlisten.mockReset();
    invokeMock.mockReset();
    invokeMock.mockResolvedValue(undefined);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 1; });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  it("finishes with one recreated child when WEB returns before an embedded open resolves", async () => {
    const opening = deferred<void>();
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frames.push(callback); return frames.length; });
    invokeMock.mockImplementation((command) => command === "open_provider_browser" ? opening.promise : Promise.resolve(undefined));
    const { result, rerender } = renderBrowser({ mode: "embedded", viewMode: "web" });
    await act(async () => { await result.current.selectProvider("music_radar"); });
    act(() => { frames.splice(0).forEach((frame) => frame(0)); });
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("open_provider_browser", expect.anything()));
    rerender({ mode: "embedded", viewMode: "sample" });
    rerender({ mode: "embedded", viewMode: "web" });
    await act(async () => { await Promise.resolve(); });
    expect(frames).toHaveLength(1);
    act(() => { frames.splice(0).forEach((frame) => frame(0)); });
    await act(async () => { opening.resolve(); await opening.promise; });
    act(() => { frames.splice(0).forEach((frame) => frame(0)); });
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("close_embedded_provider_browser", { provider: "music_radar" }));
    await act(async () => { await Promise.resolve(); });
    expect(invokeMock.mock.calls.filter(([command]) => command === "open_provider_browser")).toHaveLength(2);
  });

  it("closes and restores an embedded provider when settings open", async () => {
    const { result, rerender } = renderBrowser({ mode: "embedded", viewMode: "web" });
    await act(async () => { await result.current.selectProvider("music_radar"); });
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("open_provider_browser", expect.anything()));
    invokeMock.mockImplementation((command) => command === "close_embedded_provider_browser"
      ? Promise.resolve("https://www.musicradar.com/samples/settings-test")
      : Promise.resolve(undefined));
    rerender({ mode: "embedded", settingsOpen: true, viewMode: "web" });
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("close_embedded_provider_browser", { provider: "music_radar" }));
    rerender({ mode: "embedded", settingsOpen: false, viewMode: "web" });
    await waitFor(() => expect(invokeMock).toHaveBeenLastCalledWith("open_provider_browser", expect.objectContaining({ provider: "music_radar", mode: "embedded", url: "https://www.musicradar.com/samples/settings-test" })));
    expect(result.current.activeProvider).toBe("music_radar");
    expect(invokeMock.mock.calls.filter(([command]) => command === "open_provider_browser")).toHaveLength(2);
  });

  it("recreates an embedded provider across repeated tab changes", async () => {
    const { result, rerender } = renderBrowser({ mode: "embedded", viewMode: "web" });
    await act(async () => { await result.current.selectProvider("music_radar"); });
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("open_provider_browser", expect.anything()));
    rerender({ mode: "embedded", viewMode: "sample" });
    await waitFor(() => expect(invokeMock.mock.calls.filter(([command]) => command === "close_embedded_provider_browser")).toHaveLength(1));
    rerender({ mode: "embedded", viewMode: "web" });
    await waitFor(() => expect(invokeMock.mock.calls.filter(([command]) => command === "open_provider_browser")).toHaveLength(2));
    rerender({ mode: "embedded", viewMode: "midi" });
    rerender({ mode: "embedded", viewMode: "web" });
    await waitFor(() => expect(invokeMock.mock.calls.filter(([command]) => command === "open_provider_browser")).toHaveLength(3));
  });

  it("keeps remembered URLs isolated by provider", async () => {
    invokeMock.mockImplementation((command, payload) => command === "close_embedded_provider_browser"
      ? Promise.resolve(`https://example.test/${payload?.provider ?? ""}`)
      : Promise.resolve(undefined));
    const { result, rerender } = renderBrowser({ mode: "embedded", viewMode: "web" });
    await act(async () => { await result.current.selectProvider("music_radar"); });
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("open_provider_browser", expect.anything()));
    await act(async () => { await result.current.selectProvider("fifty_sounds"); });
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("close_embedded_provider_browser", { provider: "music_radar" }));
    rerender({ mode: "embedded", viewMode: "sample" });
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("close_embedded_provider_browser", { provider: "fifty_sounds" }));
    rerender({ mode: "embedded", viewMode: "web" });
    await waitFor(() => expect(invokeMock).toHaveBeenLastCalledWith("open_provider_browser", expect.objectContaining({
      provider: "fifty_sounds",
      mode: "embedded",
      url: "https://example.test/fifty_sounds",
    })));
  });
});
