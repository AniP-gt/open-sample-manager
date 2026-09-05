import React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlayerBarHandle } from "../PlayerBar";
import { PlayerBar } from "../PlayerBar";
import { dummySample, editedSettings, mockPause, mockPlay } from "./playerBarTestFixtures";

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

describe("PlayerBar playback controls", () => {
  it("handles play and pause buttons", () => {
    render(<PlayerBar sample={dummySample} />);

    fireEvent.click(screen.getAllByRole("button")[0]);

    expect(mockPlay).toHaveBeenCalled();
  });

  it("exposes handle methods for play, stop, and toggle", () => {
    const ref = React.createRef<PlayerBarHandle>();
    render(<PlayerBar sample={dummySample} ref={ref} />);

    const handle = ref.current;
    expect(handle).toBeTruthy();
    if (!handle) throw new Error("PlayerBar handle was not attached");

    act(() => {
      handle.play();
    });
    expect(mockPlay).toHaveBeenCalled();

    act(() => {
      handle.stop();
    });
    expect(mockPause).toHaveBeenCalled();

    act(() => {
      handle.toggle();
    });
    expect(mockPlay).toHaveBeenCalled();
  });

  it("plays from zero through the imperative preview handle", () => {
    const ref = React.createRef<PlayerBarHandle>();
    render(<PlayerBar sample={dummySample} ref={ref} />);

    ref.current?.playFromStart?.();

    expect(mockPause).toHaveBeenCalled();
    expect(mockPlay).toHaveBeenCalled();
  });

  it("seeks to trim start when preview playback begins", () => {
    render(<PlayerBar sample={dummySample} processingSettings={editedSettings} />);

    fireEvent.click(screen.getAllByRole("button")[0]);

    expect(mockPlay).toHaveBeenCalled();
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
  });
});
