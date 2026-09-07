import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FreesoundInvoke } from "../useFreesoundWorkspace";
import { useFreesoundWorkspace } from "../useFreesoundWorkspace";

function deferred<T>() {
  let resolvePromise: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolve) => { resolvePromise = resolve; });
  return { promise, resolve: resolvePromise };
}

describe("useFreesoundWorkspace lifecycle", () => {
  it("clears a stale credential error after disable, re-enable, and successful reload", async () => {
    const invoke = vi.fn<FreesoundInvoke>()
      .mockRejectedValueOnce(new Error("status failed"))
      .mockResolvedValueOnce({ configured: true });
    const { result, rerender } = renderHook(({ enabled }) => useFreesoundWorkspace(enabled, invoke), { initialProps: { enabled: true } });
    await waitFor(() => expect(result.current.error).toBe("Freesound request failed. Try again."));

    await act(async () => { rerender({ enabled: false }); });
    await act(async () => { rerender({ enabled: true }); });

    await waitFor(() => expect(result.current.credential).toBe("configured"));
    expect(result.current.error).toBeNull();
  });

  it("recovers from a save failure without leaving credentials busy", async () => {
    const invoke = vi.fn<FreesoundInvoke>()
      .mockResolvedValueOnce({ configured: false })
      .mockRejectedValueOnce(new Error("save failed"))
      .mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useFreesoundWorkspace(true, invoke));
    await waitFor(() => expect(result.current.credential).toBe("unset"));

    await act(async () => { await result.current.saveApiKey("private-key"); });
    expect(result.current.isBusy).toBe(false);
    await act(async () => { await result.current.saveApiKey("replacement-key"); });

    expect(result.current.credential).toBe("configured");
    expect(result.current.isBusy).toBe(false);
  });

  it("ignores a deferred search after disable and re-enable", async () => {
    const search = deferred<unknown>();
    const invoke = vi.fn<FreesoundInvoke>()
      .mockResolvedValueOnce({ configured: true })
      .mockReturnValueOnce(search.promise)
      .mockResolvedValueOnce({ configured: true });
    const { result, rerender } = renderHook(({ enabled }) => useFreesoundWorkspace(enabled, invoke), { initialProps: { enabled: true } });
    await waitFor(() => expect(result.current.credential).toBe("configured"));

    let request: Promise<void> = Promise.resolve();
    await act(async () => { request = result.current.search("kick", 1); });
    await act(async () => { rerender({ enabled: false }); });
    await act(async () => { rerender({ enabled: true }); });
    await waitFor(() => expect(result.current.credential).toBe("configured"));
    await act(async () => {
      search.resolve({ page: 1, pageSize: 20, totalCount: 1, hasPrevious: false, hasNext: false, sounds: [{ id: 1, name: "Late", uploader: "alice", license: "CC0", licenseUrl: "https://license", pageUrl: "https://page", previewUrl: "https://preview" }] });
      await request;
    });

    expect(result.current.results).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(result.current.isBusy).toBe(false);
  });
});
