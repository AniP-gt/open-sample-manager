import { act, renderHook, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FreesoundInvoke } from "../useFreesoundWorkspace";
import { useFreesoundWorkspace } from "../useFreesoundWorkspace";

const invokeMock = vi.fn<FreesoundInvoke>();

describe("useFreesoundWorkspace", () => {
  beforeEach(() => { invokeMock.mockReset(); });
  afterEach(() => { vi.restoreAllMocks(); });
  it("loads an unset credential status without reading a secret", async () => {
    invokeMock.mockResolvedValueOnce({ configured: false });
    const { result } = renderHook(() => useFreesoundWorkspace(true, invokeMock));

    await waitFor(() => expect(result.current.credential).toBe("unset"));

    expect(invokeMock).toHaveBeenCalledWith("get_freesound_credential_status");
  });

  it("saves then clears the submitted key from workspace state", async () => {
    invokeMock.mockResolvedValueOnce({ configured: false }).mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useFreesoundWorkspace(true, invokeMock));
    await waitFor(() => expect(result.current.credential).toBe("unset"));

    await act(async () => { await result.current.saveApiKey("private-key"); });

    expect(invokeMock).toHaveBeenLastCalledWith("save_freesound_api_key", { apiKey: "private-key" });
    expect(result.current.credential).toBe("configured");
  });

  it("searches explicitly and replaces results when changing pages", async () => {
    invokeMock.mockResolvedValueOnce({ configured: true })
      .mockResolvedValueOnce({ page: 1, pageSize: 20, totalCount: 2, hasPrevious: false, hasNext: true, sounds: [{ id: 1, name: "Kick", uploader: "alice", license: "CC0", licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/", pageUrl: "https://sound", previewUrl: "https://preview" }] });
    const { result } = renderHook(() => useFreesoundWorkspace(true, invokeMock));
    await waitFor(() => expect(result.current.credential).toBe("configured"));

    await act(async () => { await result.current.search("kick", 1); });

    expect(invokeMock).toHaveBeenLastCalledWith("search_freesound", { query: "kick", page: 1 });
    expect(result.current.results[0]?.name).toBe("Kick");
  });

  it("does not search empty input and reports authorization and rate errors", async () => {
    invokeMock.mockResolvedValueOnce({ configured: true });
    const { result } = renderHook(() => useFreesoundWorkspace(true, invokeMock));
    await waitFor(() => expect(result.current.credential).toBe("configured"));

    await act(async () => { await result.current.search("", 1); });
    expect(invokeMock).toHaveBeenCalledTimes(1);

    invokeMock.mockRejectedValueOnce({ code: "freesound_unauthorized" });
    await act(async () => { await result.current.search("kick", 1); });
    expect(result.current.error).toContain("rejected");

    invokeMock.mockRejectedValueOnce({ code: "freesound_rate_limited" });
    await act(async () => { await result.current.search("kick", 2); });
    expect(result.current.error).toContain("rate limiting");
  });

  it("deletes the key without retaining a secret or preview", async () => {
    invokeMock.mockResolvedValueOnce({ configured: true }).mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useFreesoundWorkspace(true, invokeMock));
    await waitFor(() => expect(result.current.credential).toBe("configured"));

    await act(async () => { await result.current.deleteApiKey(); });

    expect(invokeMock).toHaveBeenLastCalledWith("delete_freesound_api_key");
    expect(result.current.credential).toBe("unset");
    expect(JSON.stringify(result.current)).not.toContain("private-key");
  });

  it("converts Tauri byte arrays and cleans preview URLs when replacing and unmounting", async () => {
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL");
    const blobs: Blob[] = [];
    const createObjectURL = vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
      if (!(blob instanceof Blob)) throw new Error("expected a preview Blob");
      blobs.push(blob);
      return `blob:${blobs.length}`;
    });
    invokeMock.mockResolvedValueOnce({ configured: true }).mockResolvedValueOnce([0, 127, 255]).mockResolvedValueOnce([1]);
    const { result, unmount } = renderHook(() => useFreesoundWorkspace(true, invokeMock));
    await waitFor(() => expect(result.current.credential).toBe("configured"));

    await act(async () => { await result.current.fetchPreview("https://preview"); });
    await act(async () => { await result.current.fetchPreview("https://preview-two"); });
    unmount();

    expect(createObjectURL).toHaveBeenCalledTimes(2);
    const firstBlob = blobs[0];
    if (!firstBlob) throw new Error("expected first preview blob");
    expect([...new Uint8Array(await firstBlob.arrayBuffer())]).toEqual([0, 127, 255]);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:1");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:2");
  });

  it("stops and revokes previews when disabled or before search replaces results", async () => {
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL");
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:preview");
    invokeMock.mockResolvedValueOnce({ configured: true })
      .mockResolvedValueOnce([1])
      .mockResolvedValueOnce({ page: 2, pageSize: 20, totalCount: 0, hasPrevious: true, hasNext: false, sounds: [] })
      .mockResolvedValueOnce([2]);
    const { result, rerender } = renderHook(({ enabled }) => useFreesoundWorkspace(enabled, invokeMock), { initialProps: { enabled: true } });
    await waitFor(() => expect(result.current.credential).toBe("configured"));

    await act(async () => { await result.current.fetchPreview("https://preview"); });
    expect(result.current.previewUrl).toBe("blob:preview");
    await act(async () => { await result.current.search("kick", 2); });
    expect(result.current.previewUrl).toBeNull();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:preview");

    await act(async () => { await result.current.fetchPreview("https://preview"); });
    rerender({ enabled: false });
    expect(result.current.previewUrl).toBeNull();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:preview");
  });

  it("does not invoke duplicate synchronous searches", async () => {
    let resolveSearch: (value: unknown) => void = () => undefined;
    const searchResponse = new Promise<unknown>((resolve) => { resolveSearch = resolve; });
    invokeMock.mockResolvedValueOnce({ configured: true }).mockReturnValueOnce(searchResponse);
    const { result } = renderHook(() => useFreesoundWorkspace(true, invokeMock));
    await waitFor(() => expect(result.current.credential).toBe("configured"));

    await act(async () => { void result.current.search("kick", 1); void result.current.search("kick", 1); });
    expect(invokeMock).toHaveBeenCalledTimes(2);
    resolveSearch({ page: 1, pageSize: 20, totalCount: 0, hasPrevious: false, hasNext: false, sounds: [] });
    await act(async () => { await searchResponse; });
  });

  it("does not create a preview URL when disabled before a deferred preview resolves", async () => {
    let resolvePreview: (value: unknown) => void = () => undefined;
    const previewResponse = new Promise<unknown>((resolve) => { resolvePreview = resolve; });
    const createObjectURL = vi.spyOn(URL, "createObjectURL");
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL");
    invokeMock.mockResolvedValueOnce({ configured: true }).mockReturnValueOnce(previewResponse);
    const { result, rerender } = renderHook(({ enabled }) => useFreesoundWorkspace(enabled, invokeMock), { initialProps: { enabled: true } });
    await waitFor(() => expect(result.current.credential).toBe("configured"));

    let request: Promise<void> = Promise.resolve();
    await act(async () => { request = result.current.fetchPreview("https://preview"); });
    await act(async () => { rerender({ enabled: false }); });
    await act(async () => { resolvePreview([1]); await request; });

    expect(result.current.previewUrl).toBeNull();
    expect(revokeObjectURL).toHaveBeenCalledTimes(createObjectURL.mock.calls.length);
  });

  it("does not create a preview URL when unmounted before a deferred preview resolves", async () => {
    let resolvePreview: (value: unknown) => void = () => undefined;
    const previewResponse = new Promise<unknown>((resolve) => { resolvePreview = resolve; });
    const createObjectURL = vi.spyOn(URL, "createObjectURL");
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL");
    invokeMock.mockResolvedValueOnce({ configured: true }).mockReturnValueOnce(previewResponse);
    const { result, unmount } = renderHook(() => useFreesoundWorkspace(true, invokeMock));
    await waitFor(() => expect(result.current.credential).toBe("configured"));

    let request: Promise<void> = Promise.resolve();
    await act(async () => { request = result.current.fetchPreview("https://preview"); });
    await act(async () => { unmount(); });
    await act(async () => { resolvePreview([1]); await request; });

    expect(revokeObjectURL).toHaveBeenCalledTimes(createObjectURL.mock.calls.length);
  });

  it("commits a deferred preview in StrictMode while the workspace remains active", async () => {
    let resolvePreview: (value: unknown) => void = () => undefined;
    const previewResponse = new Promise<unknown>((resolve) => { resolvePreview = resolve; });
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:strict-preview");
    invokeMock.mockImplementation((command) => command === "fetch_freesound_preview"
      ? previewResponse
      : Promise.resolve({ configured: true }));
    const { result } = renderHook(() => useFreesoundWorkspace(true, invokeMock), { wrapper: StrictMode });
    await waitFor(() => expect(result.current.credential).toBe("configured"));

    let request: Promise<void> = Promise.resolve();
    await act(async () => { request = result.current.fetchPreview("https://preview"); });
    await act(async () => { resolvePreview([1]); await request; });

    expect(result.current.previewUrl).toBe("blob:strict-preview");
  });

  it("revokes a deferred preview response after stopPreview invalidates it", async () => {
    let resolvePreview: (value: unknown) => void = () => undefined;
    const previewResponse = new Promise<unknown>((resolve) => { resolvePreview = resolve; });
    const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:stopped-preview");
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL");
    invokeMock.mockResolvedValueOnce({ configured: true }).mockReturnValueOnce(previewResponse);
    const { result } = renderHook(() => useFreesoundWorkspace(true, invokeMock));
    await waitFor(() => expect(result.current.credential).toBe("configured"));

    let request: Promise<void> = Promise.resolve();
    await act(async () => { request = result.current.fetchPreview("https://preview"); result.current.stopPreview(); });
    await act(async () => { resolvePreview([1]); await request; });

    expect(result.current.previewUrl).toBeNull();
    expect(revokeObjectURL).toHaveBeenCalledTimes(createObjectURL.mock.calls.length);
  });

  it("rejects preview values that cannot be serialized from Rust Vec<u8>", async () => {
    invokeMock.mockResolvedValueOnce({ configured: true }).mockResolvedValueOnce([0, 256]).mockResolvedValueOnce([1.5]);
    const { result } = renderHook(() => useFreesoundWorkspace(true, invokeMock));
    await waitFor(() => expect(result.current.credential).toBe("configured"));

    await act(async () => { await result.current.fetchPreview("https://preview"); });
    expect(result.current.error).toContain("request failed");

    await act(async () => { await result.current.fetchPreview("https://preview"); });
    expect(result.current.error).toContain("request failed");
  });
});
