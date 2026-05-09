import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFile } from "@tauri-apps/plugin-fs";
import { debugCacheSize, getBlobUrlForPath, releaseBlobUrlForPath } from "../audioCache";

vi.mock("@tauri-apps/plugin-fs", () => ({
  readFile: vi.fn(),
}));

const readFileMock = vi.mocked(readFile);
const createObjectURLMock = vi.fn<(blob: Blob) => string>();
const revokeObjectURLMock = vi.fn<(url: string) => void>();

Object.defineProperty(URL, "createObjectURL", {
  configurable: true,
  value: createObjectURLMock,
});

Object.defineProperty(URL, "revokeObjectURL", {
  configurable: true,
  value: revokeObjectURLMock,
});

describe("audioCache", () => {
  beforeEach(() => {
    readFileMock.mockReset();
    createObjectURLMock.mockReset();
    revokeObjectURLMock.mockReset();
  });

  it("reuses cached blob URLs and releases after the last reference", async () => {
    readFileMock.mockResolvedValue(new Uint8Array([1, 2, 3]));
    createObjectURLMock.mockReturnValue("blob://kick");

    const first = await getBlobUrlForPath("/samples/kick.wav");
    const second = await getBlobUrlForPath("/samples/kick.wav");

    expect(first).toBe("blob://kick");
    expect(second).toBe("blob://kick");
    expect(readFileMock).toHaveBeenCalledTimes(1);
    expect(debugCacheSize()).toBe(1);

    releaseBlobUrlForPath("/samples/kick.wav");
    expect(revokeObjectURLMock).not.toHaveBeenCalled();
    expect(debugCacheSize()).toBe(1);

    releaseBlobUrlForPath("/samples/kick.wav");
    expect(revokeObjectURLMock).toHaveBeenCalledWith("blob://kick");
    expect(debugCacheSize()).toBe(0);
  });

  it("does nothing when releasing an uncached path", () => {
    releaseBlobUrlForPath("/samples/missing.wav");

    expect(revokeObjectURLMock).not.toHaveBeenCalled();
    expect(debugCacheSize()).toBe(0);
  });
});
