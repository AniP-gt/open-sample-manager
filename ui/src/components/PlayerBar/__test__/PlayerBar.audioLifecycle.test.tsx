import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlayerBar } from "../PlayerBar";
import { sharedPlayerBarAudio } from "../playerBarAudio";
import { dummySample, editedSettings } from "./playerBarTestFixtures";

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
  mockInvoke.mockResolvedValue(new Uint8Array([1, 2, 3]));
});

describe("PlayerBar audio lifecycle", () => {
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
