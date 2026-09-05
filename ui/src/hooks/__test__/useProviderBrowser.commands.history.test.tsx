import { act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderProviderBrowser } from "./providerBrowserTestHarness";

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({ invoke: invokeMock }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(() => Promise.resolve(vi.fn())) }));

describe("useProviderBrowser history commands", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockResolvedValue(undefined);
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  it("queues embedded provider history navigation without clearing the active provider", async () => {
    const { result } = renderProviderBrowser({
      attachViewport: true,
      downloadRoot: null,
      initialProps: { mode: "embedded", viewMode: "web" },
    });
    await act(async () => {
      await result.current.selectProvider("music_radar");
      await result.current.goBack();
      await result.current.goForward();
    });

    expect(invokeMock).toHaveBeenCalledWith("go_back_provider_browser", { provider: "music_radar" });
    expect(invokeMock).toHaveBeenCalledWith("go_forward_provider_browser", { provider: "music_radar" });
    expect(result.current.activeProvider).toBe("music_radar");
  });

  it("reports a sanitized provider history failure without clearing the active provider", async () => {
    const setError = vi.fn<(message: string | null) => void>();
    invokeMock.mockImplementation((command) => {
      if (command === "go_back_provider_browser") return Promise.reject({ details: "do not expose back details" });
      if (command === "go_forward_provider_browser") return Promise.reject({ details: "do not expose forward details" });
      return Promise.resolve(undefined);
    });
    const { result } = renderProviderBrowser({
      attachViewport: true,
      downloadRoot: null,
      initialProps: { mode: "embedded", viewMode: "web" },
      setError,
    });
    await act(async () => {
      await result.current.selectProvider("music_radar");
      await result.current.goBack();
      await result.current.goForward();
    });

    expect(setError).toHaveBeenCalledWith("Provider browser could not go back.");
    expect(setError).toHaveBeenCalledWith("Provider browser could not go forward.");
    expect(setError).not.toHaveBeenCalledWith(expect.stringContaining("do not expose"));
    expect(result.current.activeProvider).toBe("music_radar");
  });
});
