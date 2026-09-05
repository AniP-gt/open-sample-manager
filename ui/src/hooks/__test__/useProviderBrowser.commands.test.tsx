import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderProviderBrowser } from "./providerBrowserTestHarness";

const eventMocks = vi.hoisted(() => ({
  listeners: new Map<string, (event: { readonly payload: unknown }) => void>(),
  unlistenReady: vi.fn(),
  unlistenFailed: vi.fn(),
}));
const invokeMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn((event: string, handler: (event: { readonly payload: unknown }) => void) => {
    eventMocks.listeners.set(event, handler);
    return Promise.resolve(event === "provider-import-ready" ? eventMocks.unlistenReady : eventMocks.unlistenFailed);
  }),
}));

describe("useProviderBrowser commands", () => {
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

  it("opens each provider in window mode with the configured download root", async () => {
    const { result } = renderProviderBrowser({ initialProps: { mode: "window", viewMode: "web" } });

    await act(async () => {
      await result.current.selectProvider("music_radar");
      await result.current.selectProvider("fifty_sounds");
    });

    expect(invokeMock).toHaveBeenCalledWith("open_provider_browser", {
      provider: "music_radar",
      mode: "window",
      downloadRoot: "/Users/alice/Downloads",
    });
    expect(invokeMock).toHaveBeenCalledWith("open_provider_browser", {
      provider: "fifty_sounds",
      mode: "window",
      downloadRoot: "/Users/alice/Downloads",
    });
  });

  it("preserves a safe command code and message when a window open is rejected", async () => {
    const setError = vi.fn<(message: string | null) => void>();
    invokeMock.mockRejectedValue({
      code: "provider_policy_error",
      message: "provider surface unavailable",
      details: "do not expose this",
    });
    const { result } = renderProviderBrowser({
      downloadRoot: null,
      initialProps: { mode: "window", viewMode: "web" },
      setError,
    });

    await act(async () => { await result.current.selectProvider("music_radar"); });

    expect(setError).toHaveBeenCalledWith(
      "Provider browser could not be opened (provider_policy_error): provider surface unavailable",
    );
    expect(setError).not.toHaveBeenCalledWith(expect.stringContaining("do not expose this"));
  });

  it("closes all provider browsers before accepting a mode change", async () => {
    const { result } = renderProviderBrowser({
      downloadRoot: null,
      initialProps: { mode: "window", viewMode: "web" },
    });

    await act(async () => { await result.current.changeMode("embedded"); });
    expect(invokeMock).toHaveBeenCalledWith("close_all_provider_browsers");
  });
});
