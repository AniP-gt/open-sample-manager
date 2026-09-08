import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FreesoundInvoke } from "../useFreesoundWorkspace";
import { useFreesoundWorkspace } from "../useFreesoundWorkspace";

const invokeMock = vi.fn<FreesoundInvoke>();

describe("useFreesoundWorkspace", () => {
  beforeEach(() => { invokeMock.mockReset(); });
  afterEach(() => { vi.restoreAllMocks(); });
  it("loads an unset credential status without reading a secret", async () => {
    invokeMock.mockResolvedValueOnce({ configured: false }); const { result } = renderHook(() => useFreesoundWorkspace(true, invokeMock));
    await waitFor(() => expect(result.current.credential).toBe("unset")); expect(invokeMock).toHaveBeenCalledWith("get_freesound_credential_status");
  });
  it("saves then clears the submitted key from workspace state", async () => {
    invokeMock.mockResolvedValueOnce({ configured: false }).mockResolvedValueOnce(undefined); const { result } = renderHook(() => useFreesoundWorkspace(true, invokeMock));
    await waitFor(() => expect(result.current.credential).toBe("unset")); await act(async () => { await result.current.saveApiKey("private-key"); });
    expect(invokeMock).toHaveBeenLastCalledWith("save_freesound_api_key", { apiKey: "private-key" }); expect(result.current.credential).toBe("configured");
  });
  it("keeps a completed save when the initial credential status resolves late", async () => {
    let resolveStatus: (value: unknown) => void = () => undefined; const statusResponse = new Promise<unknown>((resolve) => { resolveStatus = resolve; });
    invokeMock.mockReturnValueOnce(statusResponse).mockResolvedValueOnce(undefined); const { result } = renderHook(() => useFreesoundWorkspace(true, invokeMock));
    await act(async () => { await result.current.saveApiKey("private-key"); }); await act(async () => { resolveStatus({ configured: false }); await statusResponse; }); expect(result.current.credential).toBe("configured");
  });
  it("keeps a completed delete when the initial credential status resolves late", async () => {
    let resolveStatus: (value: unknown) => void = () => undefined; const statusResponse = new Promise<unknown>((resolve) => { resolveStatus = resolve; });
    invokeMock.mockReturnValueOnce(statusResponse).mockResolvedValueOnce(undefined); const { result } = renderHook(() => useFreesoundWorkspace(true, invokeMock));
    await act(async () => { await result.current.deleteApiKey(); }); await act(async () => { resolveStatus({ configured: true }); await statusResponse; }); expect(result.current.credential).toBe("unset");
  });
  it("searches explicitly and replaces results when changing pages", async () => {
    invokeMock.mockResolvedValueOnce({ configured: true }).mockResolvedValueOnce({ page: 1, pageSize: 20, totalCount: 2, hasPrevious: false, hasNext: true, sounds: [{ id: 1, name: "Kick", uploader: "alice", license: "CC0", licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/", pageUrl: "https://sound", previewUrl: "https://preview" }] });
    const { result } = renderHook(() => useFreesoundWorkspace(true, invokeMock)); await waitFor(() => expect(result.current.credential).toBe("configured")); await act(async () => { await result.current.search("kick", 1); });
    expect(invokeMock).toHaveBeenLastCalledWith("search_freesound", { query: "kick", page: 1 }); expect(result.current.results[0]?.name).toBe("Kick");
  });
  it("preserves query text entered while a search is pending", async () => {
    let resolveSearch: (value: unknown) => void = () => undefined; const searchResponse = new Promise<unknown>((resolve) => { resolveSearch = resolve; });
    invokeMock.mockResolvedValueOnce({ configured: true }).mockReturnValueOnce(searchResponse); const { result } = renderHook(() => useFreesoundWorkspace(true, invokeMock)); await waitFor(() => expect(result.current.credential).toBe("configured"));
    let request: Promise<void> = Promise.resolve(); await act(async () => { request = result.current.search("kick", 1); }); act(() => { result.current.setQuery("snare"); }); await act(async () => { resolveSearch({ page: 1, pageSize: 20, totalCount: 0, hasPrevious: false, hasNext: false, sounds: [] }); await request; }); expect(result.current.query).toBe("snare");
  });
  it("does not search empty input and reports authorization and rate errors", async () => {
    invokeMock.mockResolvedValueOnce({ configured: true }); const { result } = renderHook(() => useFreesoundWorkspace(true, invokeMock)); await waitFor(() => expect(result.current.credential).toBe("configured"));
    await act(async () => { await result.current.search("", 1); }); expect(invokeMock).toHaveBeenCalledTimes(1); invokeMock.mockRejectedValueOnce(JSON.stringify({ code: "freesound_unauthorized", message: "key=secret /Users/alice/private", details: "https://private.example.test" })); await act(async () => { await result.current.search("kick", 1); }); expect(result.current.error).toBe("Freesound rejected this API key. Replace it in settings."); expect(result.current.error).not.toContain("secret"); expect(result.current.error).not.toContain("/Users/");
    invokeMock.mockRejectedValueOnce(JSON.stringify({ code: "freesound_rate_limited", message: "https://private.example.test", details: "internal details" })); await act(async () => { await result.current.search("kick", 2); }); expect(result.current.error).toBe("Freesound is rate limiting requests. Try again shortly.");
  });
  it("deletes the key without retaining a secret or preview", async () => {
    invokeMock.mockResolvedValueOnce({ configured: true }).mockResolvedValueOnce(undefined); const { result } = renderHook(() => useFreesoundWorkspace(true, invokeMock)); await waitFor(() => expect(result.current.credential).toBe("configured")); await act(async () => { await result.current.deleteApiKey(); });
    expect(invokeMock).toHaveBeenLastCalledWith("delete_freesound_api_key"); expect(result.current.credential).toBe("unset"); expect(JSON.stringify(result.current)).not.toContain("private-key");
  });

  it("downloads a saved preview then imports the exact returned path", async () => {
    const onDownloaded = vi.fn<(path: string) => Promise<void>>().mockResolvedValue(undefined);
    invokeMock.mockResolvedValueOnce({ configured: true }).mockResolvedValueOnce("/Users/alice/Downloads/Kick.mp3");
    const { result } = renderHook(() => useFreesoundWorkspace(true, invokeMock, async () => undefined, { providerDownloadRoot: "/Users/alice/Downloads", onDownloaded }));
    await waitFor(() => expect(result.current.credential).toBe("configured"));

    await act(async () => { await result.current.downloadPreview({ id: 1, name: "Kick.wav", uploader: "alice", license: "CC0", licenseUrl: "https://license", pageUrl: "https://page", previewUrl: "https://preview" }); });

    expect(invokeMock).toHaveBeenLastCalledWith("download_freesound_preview", { previewUrl: "https://preview", resultName: "Kick.wav", destinationDirectory: "/Users/alice/Downloads" });
    expect(onDownloaded).toHaveBeenCalledWith("/Users/alice/Downloads/Kick.mp3");
  });

  it("does not start duplicate preview downloads while a download is pending", async () => {
    let resolveDownload: (path: unknown) => void = () => undefined;
    const downloadResponse = new Promise<unknown>((resolve) => { resolveDownload = resolve; });
    invokeMock.mockResolvedValueOnce({ configured: true }).mockReturnValueOnce(downloadResponse);
    const { result } = renderHook(() => useFreesoundWorkspace(true, invokeMock, async () => undefined, { providerDownloadRoot: "/Users/alice/Downloads", onDownloaded: async () => undefined }));
    await waitFor(() => expect(result.current.credential).toBe("configured"));
    const sound = { id: 1, name: "Kick.wav", uploader: "alice", license: "CC0", licenseUrl: "https://license", pageUrl: "https://page", previewUrl: "https://preview" };

    await act(async () => { void result.current.downloadPreview(sound); void result.current.downloadPreview(sound); });
    expect(invokeMock).toHaveBeenCalledTimes(2);

    await act(async () => { resolveDownload("/Users/alice/Downloads/Kick.mp3"); await downloadResponse; });
  });

  it("rejects download actions without a configured root and reports a collision safely", async () => {
    invokeMock.mockResolvedValueOnce({ configured: true });
    const { result } = renderHook(() => useFreesoundWorkspace(true, invokeMock));
    await waitFor(() => expect(result.current.credential).toBe("configured"));

    await act(async () => { await result.current.downloadPreview({ id: 1, name: "Kick.wav", uploader: "alice", license: "CC0", licenseUrl: "https://license", pageUrl: "https://page", previewUrl: "https://preview" }); });

    expect(result.current.error).toContain("download folder");
    expect(invokeMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["freesound_download_destination_invalid", "The download folder is invalid."],
    ["freesound_download_destination_exists", "A file with this preview name already exists"],
    ["freesound_download_storage_failed", "The preview could not be saved."],
    ["freesound_request_failed", "Check your network connection"],
    ["freesound_preview_too_large", "The preview exceeds the 15 MB download limit."],
  ])("explains the %s preview download failure", async (code, expectedMessage) => {
    const onDownloaded = vi.fn<(path: string) => Promise<void>>().mockResolvedValue(undefined);
    invokeMock.mockResolvedValueOnce({ configured: true }).mockRejectedValueOnce(JSON.stringify({ code }));
    const { result } = renderHook(() => useFreesoundWorkspace(true, invokeMock, async () => undefined, { providerDownloadRoot: "/Users/alice/Downloads", onDownloaded }));
    await waitFor(() => expect(result.current.credential).toBe("configured"));

    await act(async () => { await result.current.downloadPreview({ id: 1, name: "Kick.wav", uploader: "alice", license: "CC0", licenseUrl: "https://license", pageUrl: "https://page", previewUrl: "https://preview" }); });

    expect(result.current.error).toContain(expectedMessage);
    expect(onDownloaded).not.toHaveBeenCalled();
  });
});
