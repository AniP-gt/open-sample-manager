import { StrictMode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProviderBrowserMode } from "../../types/provider";
import type { ViewMode } from "../../types/viewMode";
import { useProviderBrowser } from "../useProviderBrowser";

type BrowserProps = { readonly mode: ProviderBrowserMode; readonly settingsOpen?: boolean; readonly viewMode: ViewMode };
const eventMocks = vi.hoisted(() => ({ unlisten: vi.fn() }));
const invokeMock = vi.hoisted(() => vi.fn<(command: string) => Promise<unknown>>());

vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(() => Promise.resolve(eventMocks.unlisten)) }));

function renderBrowser(initialProps: BrowserProps) {
  const viewport = document.createElement("div"); vi.spyOn(viewport, "getBoundingClientRect").mockReturnValue(new DOMRect(12, 24, 640, 480));
  const rendered = renderHook<ReturnType<typeof useProviderBrowser>, BrowserProps>(
    ({ mode, settingsOpen = false, viewMode }) => useProviderBrowser({ downloadRoot: "/Users/alice/Downloads", mode, settingsOpen, viewMode, performScan: vi.fn<() => Promise<void>>().mockResolvedValue(undefined), setError: vi.fn<(message: string | null) => void>() }),
    { initialProps, wrapper: StrictMode },
  );
  act(() => rendered.result.current.viewportRef(viewport)); return rendered;
}

describe("useProviderBrowser tab clearing", () => {
  beforeEach(() => {
    eventMocks.unlisten.mockReset();
    invokeMock.mockReset();
    invokeMock.mockResolvedValue(undefined);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 1; });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  it("treats clearActiveProvider as the explicit no-restoration path", async () => {
    const { result, rerender } = renderBrowser({ mode: "embedded", viewMode: "web" });
    await act(async () => { await result.current.selectProvider("music_radar"); });
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("open_provider_browser", expect.anything()));

    await act(async () => { await result.current.clearActiveProvider(); });
    rerender({ mode: "embedded", viewMode: "sample" });
    rerender({ mode: "embedded", viewMode: "web" });

    expect(result.current.activeProvider).toBeNull();
    expect(invokeMock).toHaveBeenCalledWith("close_embedded_provider_browser", { provider: "music_radar" });
    expect(invokeMock.mock.calls.filter(([command]) => command === "open_provider_browser")).toHaveLength(1);
    expect(invokeMock).not.toHaveBeenCalledWith("show_provider_browser", expect.anything());
  });

  it("retains an embedded provider when Back close fails and clears it after retry", async () => {
    const closeFailure = new Error("native close failed");
    let closeAttempts = 0;
    invokeMock.mockImplementation((command) => {
      if (command !== "close_embedded_provider_browser") return Promise.resolve(undefined);
      closeAttempts += 1;
      return closeAttempts === 1 ? Promise.reject(closeFailure) : Promise.resolve(null);
    });
    const { result } = renderBrowser({ mode: "embedded", viewMode: "web" });
    await act(async () => { await result.current.selectProvider("music_radar"); });
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("open_provider_browser", expect.anything()));

    await act(async () => { await expect(result.current.clearActiveProvider()).rejects.toBe(closeFailure); });
    expect(result.current.activeProvider).toBe("music_radar");
    await act(async () => { await result.current.clearActiveProvider(); });
    expect(result.current.activeProvider).toBeNull();
    expect(closeAttempts).toBe(2);
  });

  it("does not hide or close window-mode providers during tab changes", async () => {
    const { result, rerender } = renderBrowser({ mode: "window", viewMode: "web" });
    await act(async () => { await result.current.selectProvider("music_radar"); });
    const callsBeforeTabChanges = invokeMock.mock.calls.length;

    rerender({ mode: "window", viewMode: "sample" });
    rerender({ mode: "window", viewMode: "midi" });
    rerender({ mode: "window", viewMode: "web" });

    expect(invokeMock.mock.calls).toHaveLength(callsBeforeTabChanges);
  });
});
