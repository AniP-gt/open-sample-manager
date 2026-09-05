import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProviderBrowserLifecycle } from "../providerBrowserLifecycle";
import type { ProviderBrowserMode } from "../../types/provider";
import type { ViewMode } from "../../types/viewMode";

type HookProps = { readonly mode: ProviderBrowserMode; readonly settingsOpen: boolean; readonly viewMode: ViewMode };
const invokeMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(() => Promise.resolve(vi.fn())) }));

function renderLifecycle(activeProvider: "music_radar" | "fifty_sounds" | null, setError = vi.fn<(message: string | null) => void>()) {
  return renderHook<ReturnType<typeof useProviderBrowserLifecycle>, HookProps>((props) => useProviderBrowserLifecycle({
    activeProvider,
    downloadRoot: "/Users/alice/Downloads",
    mode: props.mode,
    settingsOpen: props.settingsOpen,
    setActiveProvider: vi.fn<(provider: "music_radar" | "fifty_sounds" | null) => void>(),
    setError,
    setStatus: vi.fn<(status: string | null) => void>(),
    viewMode: props.viewMode,
    viewport: null,
  }), { initialProps: { mode: "embedded", settingsOpen: false, viewMode: "web" } });
}

describe("useProviderBrowser departure lifecycle", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockResolvedValue(undefined);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  it("closes the active embedded provider when leaving WEB after a viewport-less remount", async () => {
    const lifecycle = renderLifecycle("music_radar");
    await act(async () => { await Promise.resolve(); });
    invokeMock.mockClear();

    lifecycle.rerender({ mode: "embedded", settingsOpen: false, viewMode: "sample" });
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("close_embedded_provider_browser", { provider: "music_radar" }));
  });

  it("closes all provider browsers when leaving embedded WEB without an active provider", async () => {
    const lifecycle = renderLifecycle(null);
    await act(async () => {
      await expect(lifecycle.result.current.hideEmbeddedBrowserBeforeLeavingWeb()).resolves.toBe(true);
    });

    expect(invokeMock).toHaveBeenCalledWith("close_all_provider_browsers");
  });

  it("blocks an embedded WEB departure when closing all provider browsers fails", async () => {
    const setError = vi.fn<(message: string | null) => void>();
    invokeMock.mockRejectedValueOnce(new Error("native close failed"));
    const lifecycle = renderLifecycle(null, setError);
    setError("Provider browser could not be opened.");
    setError.mockClear();

    await act(async () => {
      await expect(lifecycle.result.current.hideEmbeddedBrowserBeforeLeavingWeb()).resolves.toBe(false);
    });

    expect(setError).toHaveBeenNthCalledWith(1, null);
    expect(setError).toHaveBeenLastCalledWith("Provider browser could not be closed.");
  });
});
