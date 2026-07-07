import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type React from "react";
import { invoke } from "@tauri-apps/api/core";
import { startDrag } from "@crabnebula/tauri-plugin-drag";
import { prepareDragFile, startFileDrag } from "../fileDragOut";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

vi.mock("@crabnebula/tauri-plugin-drag", () => ({
  startDrag: vi.fn().mockResolvedValue(undefined),
}));

describe("fileDragOut", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("prepares raw drag files when processing settings are unchanged", async () => {
    const preparedPathsRef: React.MutableRefObject<Record<string, string>> = { current: {} };
    vi.mocked(invoke).mockResolvedValueOnce("/tmp/raw.wav");

    prepareDragFile("/samples/kick.wav", 1, preparedPathsRef);
    await Promise.resolve();

    expect(invoke).toHaveBeenCalledWith("prepare_drag_file", { path: "/samples/kick.wav" });
    expect(preparedPathsRef.current[1]).toBe("/tmp/raw.wav");
  });

  it("prepares processed WAVs when processing settings are edited", async () => {
    const preparedPathsRef: React.MutableRefObject<Record<string, string>> = { current: {} };
    vi.mocked(invoke).mockResolvedValueOnce("/tmp/processed.wav");

    prepareDragFile("/samples/kick.wav", "1:edited", preparedPathsRef, {
      trimStartSeconds: 0.5,
      trimEndSeconds: 2,
      fadeInSeconds: 0.1,
      fadeOutSeconds: 0.2,
      gainDb: -3,
    });
    await Promise.resolve();

    expect(invoke).toHaveBeenCalledWith("prepare_processed_drag_file", {
      path: "/samples/kick.wav",
      params: {
        trim_start_seconds: 0.5,
        trim_end_seconds: 2,
        fade_in_seconds: 0.1,
        fade_out_seconds: 0.2,
        gain_db: -3,
      },
    });
    expect(preparedPathsRef.current["1:edited"]).toBe("/tmp/processed.wav");
  });

  it.each([
    {
      label: "gain-only",
      processingSettings: {
        trimStartSeconds: 0,
        trimEndSeconds: 0,
        fadeInSeconds: 0,
        fadeOutSeconds: 0,
        gainDb: 2,
      },
    },
    {
      label: "fade-only",
      processingSettings: {
        trimStartSeconds: 0,
        trimEndSeconds: 0,
        fadeInSeconds: 0.25,
        fadeOutSeconds: 0,
        gainDb: 0,
      },
    },
  ])("sends trim_end_seconds null for $label edits", async ({ processingSettings }) => {
    const preparedPathsRef: React.MutableRefObject<Record<string, string>> = { current: {} };
    vi.mocked(invoke).mockResolvedValueOnce("/tmp/processed.wav");

    prepareDragFile("/samples/kick.wav", `1:${processingSettings.gainDb}:${processingSettings.fadeInSeconds}`, preparedPathsRef, processingSettings);
    await Promise.resolve();

    expect(invoke).toHaveBeenCalledWith("prepare_processed_drag_file", {
      path: "/samples/kick.wav",
      params: {
        trim_start_seconds: 0,
        trim_end_seconds: null,
        fade_in_seconds: processingSettings.fadeInSeconds,
        fade_out_seconds: processingSettings.fadeOutSeconds,
        gain_db: processingSettings.gainDb,
      },
    });
    expect(preparedPathsRef.current[`1:${processingSettings.gainDb}:${processingSettings.fadeInSeconds}`]).toBe(
      "/tmp/processed.wav",
    );
  });

  it("sends trim_end_seconds null when trim end is not after trim start", async () => {
    const preparedPathsRef: React.MutableRefObject<Record<string, string>> = { current: {} };
    vi.mocked(invoke).mockResolvedValueOnce("/tmp/processed.wav");

    prepareDragFile("/samples/kick.wav", "trim-invalid", preparedPathsRef, {
      trimStartSeconds: 2,
      trimEndSeconds: 1,
      fadeInSeconds: 0,
      fadeOutSeconds: 0,
      gainDb: 0,
    });
    await Promise.resolve();

    expect(invoke).toHaveBeenCalledWith("prepare_processed_drag_file", {
      path: "/samples/kick.wav",
      params: {
        trim_start_seconds: 2,
        trim_end_seconds: null,
        fade_in_seconds: 0,
        fade_out_seconds: 0,
        gain_db: 0,
      },
    });
  });

  it("does not fall back to raw path when edited drag starts before preparation finishes", async () => {
    const preparedPathsRef: React.MutableRefObject<Record<string, string>> = { current: {} };
    vi.mocked(invoke).mockResolvedValueOnce("/tmp/processed.wav");
    const event = { preventDefault: vi.fn() } as unknown as React.DragEvent;

    startFileDrag(
      event,
      "/samples/kick.wav",
      "edited",
      preparedPathsRef,
      "/tmp/icon.png",
      "[test]",
      {
        trimStartSeconds: 0,
        trimEndSeconds: 0,
        fadeInSeconds: 0,
        fadeOutSeconds: 0,
        gainDb: 3,
      },
    );
    await Promise.resolve();
    await Promise.resolve();

    expect(event.preventDefault).toHaveBeenCalled();
    expect(invoke).toHaveBeenCalledWith("prepare_processed_drag_file", {
      path: "/samples/kick.wav",
      params: {
        trim_start_seconds: 0,
        trim_end_seconds: null,
        fade_in_seconds: 0,
        fade_out_seconds: 0,
        gain_db: 3,
      },
    });
    expect(startDrag).toHaveBeenCalledWith({ item: ["/tmp/processed.wav"], icon: "/tmp/icon.png" });
    expect(startDrag).not.toHaveBeenCalledWith({ item: ["/samples/kick.wav"], icon: "/tmp/icon.png" });
  });

  it("cleans up processed drag files prepared during drag start", async () => {
    vi.useFakeTimers();
    const preparedPathsRef: React.MutableRefObject<Record<string, string>> = { current: {} };
    vi.mocked(invoke).mockResolvedValue(undefined);
    vi.mocked(invoke).mockResolvedValueOnce("/tmp/processed.wav");
    const event = { preventDefault: vi.fn() } as unknown as React.DragEvent;

    startFileDrag(
      event,
      "/samples/kick.wav",
      "edited-cleanup",
      preparedPathsRef,
      "/tmp/icon.png",
      "[test]",
      {
        trimStartSeconds: 0,
        trimEndSeconds: 0,
        fadeInSeconds: 0,
        fadeOutSeconds: 0,
        gainDb: 3,
      },
    );
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    vi.runOnlyPendingTimers();
    await Promise.resolve();

    expect(invoke).toHaveBeenCalledWith("delete_file", { path: "/tmp/processed.wav" });
    expect(preparedPathsRef.current["edited-cleanup"]).toBeUndefined();
  });

  it("cleans up processed drag files when native drag rejects", async () => {
    vi.useFakeTimers();
    const preparedPathsRef: React.MutableRefObject<Record<string, string>> = { current: {} };
    vi.mocked(invoke).mockResolvedValue(undefined);
    vi.mocked(invoke).mockResolvedValueOnce("/tmp/processed.wav");
    vi.mocked(startDrag).mockRejectedValueOnce(new Error("drag failed"));
    const event = { preventDefault: vi.fn() } as unknown as React.DragEvent;

    startFileDrag(
      event,
      "/samples/kick.wav",
      "edited-reject-cleanup",
      preparedPathsRef,
      "/tmp/icon.png",
      "[test]",
      {
        trimStartSeconds: 0,
        trimEndSeconds: 0,
        fadeInSeconds: 0,
        fadeOutSeconds: 0,
        gainDb: 3,
      },
    );
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    vi.runOnlyPendingTimers();
    await Promise.resolve();

    expect(startDrag).toHaveBeenCalledWith({ item: ["/tmp/processed.wav"], icon: "/tmp/icon.png" });
    expect(invoke).toHaveBeenCalledWith("delete_file", { path: "/tmp/processed.wav" });
    expect(preparedPathsRef.current["edited-reject-cleanup"]).toBeUndefined();
  });

  it("logs raw export only after native drag succeeds", async () => {
    const preparedPathsRef: React.MutableRefObject<Record<string, string>> = { current: {} };
    const event = { preventDefault: vi.fn() } as unknown as React.DragEvent;
    const onExportSuccess = vi.fn();

    startFileDrag(
      event,
      "/samples/kick.wav",
      "raw",
      preparedPathsRef,
      "/tmp/icon.png",
      "[test]",
      undefined,
      { sampleId: 9, onExportSuccess },
    );
    await Promise.resolve();

    expect(onExportSuccess).toHaveBeenCalledWith(9, "raw");
  });

  it("does not log export when native drag rejects", async () => {
    const preparedPathsRef: React.MutableRefObject<Record<string, string>> = { current: {} };
    vi.mocked(startDrag).mockRejectedValueOnce(new Error("drag failed"));
    const event = { preventDefault: vi.fn() } as unknown as React.DragEvent;
    const onExportSuccess = vi.fn();

    startFileDrag(
      event,
      "/samples/kick.wav",
      "raw-reject",
      preparedPathsRef,
      "/tmp/icon.png",
      "[test]",
      undefined,
      { sampleId: 9, onExportSuccess },
    );
    await Promise.resolve();

    expect(onExportSuccess).not.toHaveBeenCalled();
  });

});
