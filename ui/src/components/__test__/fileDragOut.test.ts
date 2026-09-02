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

  it("does not prepare raw drag files when processing settings are unchanged", async () => {
    const preparedPathsRef: React.MutableRefObject<Record<string, string>> = { current: {} };

    prepareDragFile("/samples/kick.wav", 1, preparedPathsRef);
    await Promise.resolve();

    expect(invoke).not.toHaveBeenCalledWith("prepare_drag_file", { path: "/samples/kick.wav" });
    expect(preparedPathsRef.current).toStrictEqual({});
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

  it("uses source path for unedited drag when cache is empty", async () => {
    vi.useFakeTimers();
    const preparedPathsRef: React.MutableRefObject<Record<string, string>> = { current: {} };
    vi.mocked(startDrag).mockResolvedValue(undefined);
    vi.mocked(invoke).mockResolvedValue(undefined);
    const event = { preventDefault: vi.fn() } as unknown as React.DragEvent;

    startFileDrag(
      event,
      "/samples/kick.wav",
      "raw-empty",
      preparedPathsRef,
      "/tmp/icon.png",
      "[test]",
    );
    await Promise.resolve();

    vi.advanceTimersByTime(2000);
    await Promise.resolve();

    expect(startDrag).toHaveBeenCalledWith({ item: ["/samples/kick.wav"], icon: "/tmp/icon.png" });
    expect(invoke).not.toHaveBeenCalledWith("delete_file", expect.any(Object));
    expect(preparedPathsRef.current).toStrictEqual({});
  });

  it("keeps a processed drag file cached after cleanup delay", async () => {
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

    vi.advanceTimersByTime(2000);
    await Promise.resolve();

    expect(invoke).not.toHaveBeenCalledWith("delete_file", { path: "/tmp/processed.wav" });
    expect(preparedPathsRef.current["edited-cleanup"]).toBe("/tmp/processed.wav");
  });

  it("uses the source path instead of a stale prepared raw drag path", async () => {
    vi.useFakeTimers();
    const preparedPathsRef: React.MutableRefObject<Record<string, string>> = { current: { "raw-cleanup": "/tmp/raw.wav" } };
    vi.mocked(startDrag).mockResolvedValue(undefined);
    const event = { preventDefault: vi.fn() } as unknown as React.DragEvent;

    startFileDrag(
      event,
      "/samples/kick.wav",
      "raw-cleanup",
      preparedPathsRef,
      "/tmp/icon.png",
      "[test]",
    );
    await Promise.resolve();

    expect(startDrag).toHaveBeenCalledWith({ item: ["/samples/kick.wav"], icon: "/tmp/icon.png" });
    expect(invoke).not.toHaveBeenCalledWith("prepare_drag_file", { path: "/samples/kick.wav" });
    expect(preparedPathsRef.current["raw-cleanup"]).toBe("/tmp/raw.wav");
  });
});
