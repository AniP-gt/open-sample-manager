import { act, waitFor } from "@testing-library/react";
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

describe("useProviderBrowser lifecycle state", () => {
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

  it("does not reopen an embedded browser after it is cleared", async () => {
    const { result } = renderProviderBrowser({
      attachViewport: true,
      initialProps: { mode: "embedded", viewMode: "web" },
    });

    await act(async () => { await result.current.selectProvider("music_radar"); });
    await act(async () => { await result.current.clearActiveProvider(); });

    expect(result.current.activeProvider).toBeNull();
    expect(result.current.status).toBeNull();
    expect(invokeMock).not.toHaveBeenCalledWith("show_provider_browser", { provider: "music_radar" });
  });

  it("surfaces an embedded open invoke rejection without a failure event", async () => {
    const setError = vi.fn<(message: string | null) => void>();
    const { result } = renderProviderBrowser({
      attachViewport: true,
      initialProps: { mode: "embedded", viewMode: "web" },
      setError,
    });
    invokeMock.mockRejectedValueOnce({
      code: "provider_surface_unavailable",
      message: "native surface unavailable",
    });

    await act(async () => { await result.current.selectProvider("music_radar"); });

    await waitFor(() => expect(result.current.activeProvider).toBeNull());
    expect(eventMocks.listeners.has("provider-browser-failed")).toBe(false);
    expect(result.current.status).toBeNull();
    expect(setError).toHaveBeenCalledWith(
      "Provider browser could not be opened (provider_surface_unavailable): native surface unavailable",
    );
  });
});
