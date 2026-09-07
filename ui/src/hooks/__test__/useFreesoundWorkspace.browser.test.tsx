import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FreesoundInvoke, FreesoundOpen } from "../useFreesoundWorkspace";
import { useFreesoundWorkspace } from "../useFreesoundWorkspace";

const invoke = vi.fn<FreesoundInvoke>().mockResolvedValue({ configured: true });

function deferred<T>() {
  let rejectPromise: (reason?: unknown) => void = () => undefined;
  const promise = new Promise<T>((_resolve, reject) => { rejectPromise = reject; });
  return { promise, reject: rejectPromise };
}

describe("useFreesoundWorkspace browser action", () => {
  it("opens the fixed Freesound API registration page", async () => {
    const open = vi.fn<FreesoundOpen>().mockResolvedValue(undefined);
    const { result } = renderHook(() => useFreesoundWorkspace(true, invoke, open));
    await waitFor(() => expect(result.current.credential).toBe("configured"));

    await act(async () => { await result.current.openRegistration(); });

    expect(open).toHaveBeenCalledWith("https://freesound.org/apiv2/apply/");
  });

  it("reports registration-page failures through the Freesound error state", async () => {
    const open = vi.fn<FreesoundOpen>().mockRejectedValue(new Error("open failed"));
    const { result } = renderHook(() => useFreesoundWorkspace(true, invoke, open));
    await waitFor(() => expect(result.current.credential).toBe("configured"));

    await act(async () => { await result.current.openRegistration(); });

    expect(result.current.error).toBe("Freesound request failed. Try again.");
  });

  it("opens the fixed Freesound homepage", async () => {
    const open = vi.fn<FreesoundOpen>().mockResolvedValue(undefined);
    const { result } = renderHook(() => useFreesoundWorkspace(true, invoke, open));
    await waitFor(() => expect(result.current.credential).toBe("configured"));

    await act(async () => { await result.current.openHomepage(); });

    expect(open).toHaveBeenCalledWith("https://freesound.org/");
  });

  it("reports browser-open failures through the Freesound error state", async () => {
    const open = vi.fn<FreesoundOpen>().mockRejectedValue(new Error("open failed"));
    const { result } = renderHook(() => useFreesoundWorkspace(true, invoke, open));
    await waitFor(() => expect(result.current.credential).toBe("configured"));

    await act(async () => { await result.current.openHomepage(); });

    expect(result.current.error).toBe("Freesound request failed. Try again.");
  });

  it("ignores a delayed browser rejection after disable and re-enable", async () => {
    const opening = deferred<void>();
    const open = vi.fn<FreesoundOpen>().mockReturnValue(opening.promise);
    const { result, rerender } = renderHook(({ enabled }) => useFreesoundWorkspace(enabled, invoke, open), { initialProps: { enabled: true } });
    await waitFor(() => expect(result.current.credential).toBe("configured"));

    let request: Promise<void> = Promise.resolve();
    await act(async () => { request = result.current.openHomepage(); });
    await act(async () => { rerender({ enabled: false }); });
    await act(async () => { rerender({ enabled: true }); });
    await act(async () => { opening.reject(new Error("late failure")); await request; });

    expect(result.current.error).toBeNull();
  });

  it("does not let a successful browser retry clear a newer search error", async () => {
    const searchInvoke = vi.fn<FreesoundInvoke>().mockResolvedValueOnce({ configured: true }).mockRejectedValueOnce(new Error("search failed"));
    const open = vi.fn<FreesoundOpen>().mockRejectedValueOnce(new Error("browser failed")).mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useFreesoundWorkspace(true, searchInvoke, open));
    await waitFor(() => expect(result.current.credential).toBe("configured"));

    await act(async () => { await result.current.openHomepage(); });
    await act(async () => { await result.current.search("kick", 1); });
    await act(async () => { await result.current.openHomepage(); });

    expect(result.current.error).toBe("Freesound request failed. Try again.");
  });
});
