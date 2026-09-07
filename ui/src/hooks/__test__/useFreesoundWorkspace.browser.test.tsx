import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FreesoundInvoke, FreesoundOpen } from "../useFreesoundWorkspace";
import { useFreesoundWorkspace } from "../useFreesoundWorkspace";

const invoke = vi.fn<FreesoundInvoke>().mockResolvedValue({ configured: true });

describe("useFreesoundWorkspace browser action", () => {
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
});
