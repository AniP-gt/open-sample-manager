import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlayerBar } from "../PlayerBar";
import { sharedPlayerBarAudio } from "../playerBarAudio";
import { dummySample, editedSettings } from "./playerBarTestFixtures";
import { useSettingsStore } from "../../../store/useSettingsStore";

const { mockInvoke } = vi.hoisted(() => ({ mockInvoke: vi.fn() }));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    lazy: (_loader: () => Promise<unknown>) => (_props: Record<string, unknown>) => <div data-testid="lazy-wavesurfer-player" />,
    Suspense: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (path: string) => `asset://${path}`,
  invoke: mockInvoke,
}));

beforeEach(() => {
  useSettingsStore.getState().setLanguage("en");
  mockInvoke.mockResolvedValue(new Uint8Array([1, 2, 3]));
});

afterEach(() => { act(() => { useSettingsStore.getState().setLanguage("en"); }); });

describe("PlayerBar audio lifecycle", () => {
  it("records audible playback rather than selection or a request to play", async () => {
    Object.defineProperties(URL, {
      createObjectURL: { configurable: true, value: vi.fn(() => "blob:usage") },
      revokeObjectURL: { configurable: true, value: vi.fn() },
    });
    const { unmount } = render(<PlayerBar sample={dummySample} path="/test/test.wav" />);
    await act(async () => { await vi.advanceTimersByTimeAsync(50); });
    expect(mockInvoke).not.toHaveBeenCalledWith("record_sample_usage", expect.anything());
    await act(async () => { sharedPlayerBarAudio.onplaying?.(new Event("playing")); });
    expect(mockInvoke).toHaveBeenCalledWith("record_sample_usage", { sampleId: 1, kind: "preview" });
    unmount();
    expect(sharedPlayerBarAudio.onplaying).toBeNull();
  });
  it("does not show a transient load error when the active audio finishes loading", async () => {
    Object.defineProperties(URL, {
      createObjectURL: { configurable: true, value: vi.fn(() => "blob:current") },
      revokeObjectURL: { configurable: true, value: vi.fn() },
    });
    render(<PlayerBar sample={dummySample} path="/test/test.wav" />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    act(() => {
      sharedPlayerBarAudio.onerror?.(new Event("error"));
    });
    expect(screen.queryByText("Could not read the file")).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
      sharedPlayerBarAudio.onloadedmetadata?.(new Event("loadedmetadata"));
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(screen.queryByText("Could not read the file")).not.toBeInTheDocument();
  });

  it.each(["en", "ja"] as const)("shows a persistent load error after the confirmation delay in %s", async (language) => {
    useSettingsStore.getState().setLanguage(language);
    const expectedError = language === "ja" ? "ファイルを読み込めません" : "Could not read the file";
    Object.defineProperties(URL, {
      createObjectURL: { configurable: true, value: vi.fn(() => "blob:current") },
      revokeObjectURL: { configurable: true, value: vi.fn() },
    });
    render(<PlayerBar sample={dummySample} path="/test/test.wav" />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    act(() => {
      sharedPlayerBarAudio.onerror?.(new Event("error"));
    });
    expect(screen.queryByText(expectedError)).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(screen.getByText(expectedError)).toBeInTheDocument();
  });

  it("preserves the audio source and position when the display language changes", async () => {
    Object.defineProperties(URL, {
      createObjectURL: { configurable: true, value: vi.fn(() => "blob:language") },
      revokeObjectURL: { configurable: true, value: vi.fn() },
    });
    render(<PlayerBar sample={dummySample} path="/test/test.wav" />);
    await act(async () => { await vi.advanceTimersByTimeAsync(50); });
    sharedPlayerBarAudio.currentTime = 2.5;

    act(() => { useSettingsStore.getState().setLanguage("ja"); });

    expect(sharedPlayerBarAudio.src).toBe("blob:language");
    expect(sharedPlayerBarAudio.currentTime).toBe(2.5);
    expect(mockInvoke.mock.calls.filter(([command]) => command === "read_audio_file")).toHaveLength(1);
    expect(document.documentElement.lang).toBe("ja");
  });

  it("does not install a deferred prior-path response after path intent changes", async () => {
    let resolveFirstLoad: ((bytes: ArrayBuffer) => void) | undefined;
    mockInvoke.mockImplementationOnce(() => new Promise<ArrayBuffer>((resolve) => {
      resolveFirstLoad = resolve;
    }));
    const createObjectUrl = vi.fn(() => "blob:current");
    const revokeObjectUrl = vi.fn();
    Object.defineProperties(URL, {
      createObjectURL: { configurable: true, value: createObjectUrl },
      revokeObjectURL: { configurable: true, value: revokeObjectUrl },
    });
    const { rerender } = render(<PlayerBar sample={dummySample} path="/test/first.wav" />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    rerender(<PlayerBar sample={dummySample} path="/test/second.wav" />);
    await act(async () => {
      resolveFirstLoad?.(new Uint8Array([9]).buffer);
    });

    expect(createObjectUrl).not.toHaveBeenCalled();
    expect(revokeObjectUrl).not.toHaveBeenCalled();
  });

  it("keeps B audio installed when keyed PlayerBar A unmounts before A resolves", async () => {
    let resolveA: ((bytes: ArrayBuffer) => void) | undefined;
    let resolveB: ((bytes: ArrayBuffer) => void) | undefined;
    mockInvoke
      .mockImplementationOnce(() => new Promise<ArrayBuffer>((resolve) => {
        resolveA = resolve;
      }))
      .mockImplementationOnce(() => new Promise<ArrayBuffer>((resolve) => {
        resolveB = resolve;
      }));
    const createObjectUrl = vi.fn((blob: Blob) => blob.size === 1 ? "blob:B" : "blob:A");
    Object.defineProperties(URL, {
      createObjectURL: { configurable: true, value: createObjectUrl },
      revokeObjectURL: { configurable: true, value: vi.fn() },
    });
    const { rerender } = render(<PlayerBar key="A" sample={dummySample} path="/test/a.wav" />);

    rerender(<PlayerBar key="B" sample={dummySample} path="/test/b.wav" />);
    await act(async () => {
      resolveB?.(new Uint8Array([2]).buffer);
    });
    await act(async () => {
      resolveA?.(new Uint8Array([1, 2]).buffer);
    });

    expect(sharedPlayerBarAudio.src).toBe("blob:B");
  });

  it("does not reread audio when trim settings change", async () => {
    const { rerender } = render(<PlayerBar sample={dummySample} path="/test/test.wav" />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    rerender(
      <PlayerBar
        sample={dummySample}
        path="/test/test.wav"
        processingSettings={{ ...editedSettings, trimEndSeconds: 3 }}
      />,
    );

    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it("revokes the active object URL when path intent changes", async () => {
    const createObjectUrl = vi.fn(() => "blob:current");
    const revokeObjectUrl = vi.fn();
    Object.defineProperties(URL, {
      createObjectURL: { configurable: true, value: createObjectUrl },
      revokeObjectURL: { configurable: true, value: revokeObjectUrl },
    });
    const { rerender } = render(<PlayerBar sample={dummySample} path="/test/first.wav" />);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    rerender(<PlayerBar sample={dummySample} path="/test/second.wav" />);

    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:current");
  });
});
