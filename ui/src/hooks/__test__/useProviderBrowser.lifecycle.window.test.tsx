import { act, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import type { PropsWithChildren } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderProviderBrowser } from "./providerBrowserTestHarness";

const eventMocks = vi.hoisted(() => ({ listeners: new Map<string, (event: { readonly payload: unknown }) => void>() }));
const invokeMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn((event: string, handler: (event: { readonly payload: unknown }) => void) => {
    eventMocks.listeners.set(event, handler);
    return Promise.resolve(vi.fn());
  }),
}));

function StrictModeWrapper({ children }: PropsWithChildren) {
  return <StrictMode>{children}</StrictMode>;
}

describe("useProviderBrowser window lifecycle", () => {
  beforeEach(() => {
    eventMocks.listeners.clear();
    invokeMock.mockReset();
    invokeMock.mockResolvedValue(undefined);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  it("settles a window browser after its open invoke succeeds without a readiness event", async () => {
    const { result } = renderProviderBrowser({ initialProps: { mode: "window", viewMode: "web" } });

    await act(async () => { await result.current.selectProvider("music_radar"); });

    expect(invokeMock).toHaveBeenCalledWith("open_provider_browser", {
      provider: "music_radar",
      mode: "window",
      downloadRoot: "/Users/alice/Downloads",
    });
    expect(eventMocks.listeners.has("provider-browser-ready")).toBe(false);
    expect(eventMocks.listeners.has("provider-browser-failed")).toBe(false);
    await waitFor(() => expect(result.current.status).toBeNull());
  });

  it("keeps a current deferred window open after its lifecycle rerender", async () => {
    let resolveOpen: (() => void) | undefined;
    const deferredOpen = new Promise<void>((resolve) => { resolveOpen = resolve; });
    invokeMock.mockImplementation((command) => (
      command === "open_provider_browser" ? deferredOpen : Promise.resolve(undefined)
    ));
    const { result } = renderProviderBrowser({ initialProps: { mode: "window", viewMode: "web" } });
    let selection: Promise<void> | undefined;

    act(() => { selection = result.current.selectProvider("music_radar"); });

    await act(async () => {
      resolveOpen?.();
      await selection;
    });

    await waitFor(() => expect(result.current.status).toBeNull());
    expect(invokeMock).not.toHaveBeenCalledWith("close_all_provider_browsers");
  });

  it("closes a stale window open before allowing the current provider to own its surface", async () => {
    let resolveFirstOpen: (() => void) | undefined;
    const firstOpen = new Promise<void>((resolve) => { resolveFirstOpen = resolve; });
    let openCount = 0;
    invokeMock.mockImplementation((command) => {
      if (command !== "open_provider_browser") return Promise.resolve(undefined);
      openCount += 1;
      return openCount === 1 ? firstOpen : Promise.resolve(undefined);
    });
    const { result } = renderProviderBrowser({ initialProps: { mode: "window", viewMode: "web" } });
    let firstSelection: Promise<void> | undefined;
    let secondSelection: Promise<void> | undefined;
    act(() => {
      firstSelection = result.current.selectProvider("music_radar");
      secondSelection = result.current.selectProvider("fifty_sounds");
    });

    await act(async () => {
      resolveFirstOpen?.();
      await firstSelection;
      await secondSelection;
    });

    expect(invokeMock).toHaveBeenCalledWith("close_all_provider_browsers");
    expect(invokeMock).toHaveBeenCalledWith("open_provider_browser", expect.objectContaining({
      provider: "fifty_sounds",
      mode: "window",
    }));
    expect(result.current.activeProvider).toBe("fifty_sounds");
  });

  it("opens a window browser after StrictMode replays the lifecycle", async () => {
    const { result } = renderProviderBrowser({
      initialProps: { mode: "window", viewMode: "web" },
      wrapper: StrictModeWrapper,
    });

    await act(async () => { await result.current.selectProvider("music_radar"); });

    expect(invokeMock).toHaveBeenCalledWith("open_provider_browser", {
      provider: "music_radar",
      mode: "window",
      downloadRoot: "/Users/alice/Downloads",
    });
    await waitFor(() => expect(result.current.status).toBeNull());
  });
});
