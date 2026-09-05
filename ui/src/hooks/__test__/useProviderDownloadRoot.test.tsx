import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProviderDownloadRoot } from "../useProviderDownloadRoot";

const openMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/plugin-dialog", () => ({ open: openMock }));

describe("useProviderDownloadRoot", () => {
  beforeEach(() => {
    openMock.mockReset();
  });

  it("selects one directory through the trusted folder picker", async () => {
    openMock.mockResolvedValue("/Users/alice/Provider Downloads");
    const setProviderDownloadRoot = vi.fn<(directory: string | null) => void>();
    const { result } = renderHook(() => useProviderDownloadRoot({
      setProviderDownloadRoot,
      setError: vi.fn<(message: string | null) => void>(),
    }));

    await act(async () => {
      await result.current.selectProviderDownloadRoot();
    });

    expect(openMock).toHaveBeenCalledWith({
      directory: true,
      multiple: false,
      title: "Select Provider Download Folder",
    });
    expect(setProviderDownloadRoot).toHaveBeenCalledWith("/Users/alice/Provider Downloads");
  });
});
