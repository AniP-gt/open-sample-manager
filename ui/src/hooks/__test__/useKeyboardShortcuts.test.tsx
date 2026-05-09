import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { RefObject } from "react";
import type { PlayerBarHandle } from "../../components";
import { useKeyboardShortcuts } from "../useKeyboardShortcuts";

const dispatchKey = (code: string, target?: Element, init: KeyboardEventInit = {}) => {
  const event = new KeyboardEvent("keydown", { code, bubbles: true, cancelable: true, ...init });
  const prevented = vi.spyOn(event, "preventDefault");
  (target ?? document.body).dispatchEvent(event);
  return prevented;
};

describe("useKeyboardShortcuts", () => {
  it("plays the selected sample on Space and toggles on Enter", () => {
    const player = { play: vi.fn(), stop: vi.fn(), toggle: vi.fn(), isPlaying: false } satisfies PlayerBarHandle;
    const playerBarRef = { current: player } satisfies RefObject<PlayerBarHandle | null>;

    renderHook(() =>
      useKeyboardShortcuts({
        viewMode: "sample",
        sampleState: { selected: { id: 1 } },
        midiState: { selectedMidi: null, togglePlaySelectedMidi: vi.fn() },
        playerBarRef,
      }),
    );

    expect(dispatchKey("Space")).toHaveBeenCalled();
    expect(player.play).toHaveBeenCalled();

    expect(dispatchKey("Enter")).toHaveBeenCalled();
    expect(player.toggle).toHaveBeenCalled();
  });

  it("toggles selected MIDI playback on Space", () => {
    const togglePlaySelectedMidi = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    renderHook(() =>
      useKeyboardShortcuts({
        viewMode: "midi",
        sampleState: { selected: null },
        midiState: { selectedMidi: { id: 2 }, togglePlaySelectedMidi },
        playerBarRef: { current: null },
      }),
    );

    expect(dispatchKey("Space")).toHaveBeenCalled();
    expect(togglePlaySelectedMidi).toHaveBeenCalled();
  });

  it("ignores modified keys and interactive targets", () => {
    const player = { play: vi.fn(), stop: vi.fn(), toggle: vi.fn(), isPlaying: false } satisfies PlayerBarHandle;
    const input = document.createElement("input");
    document.body.appendChild(input);

    const { unmount } = renderHook(() =>
      useKeyboardShortcuts({
        viewMode: "sample",
        sampleState: { selected: { id: 1 } },
        midiState: { selectedMidi: null, togglePlaySelectedMidi: vi.fn() },
        playerBarRef: { current: player },
      }),
    );

    dispatchKey("Space", undefined, { ctrlKey: true });
    dispatchKey("Space", input);
    dispatchKey("Enter", input);

    expect(player.play).not.toHaveBeenCalled();
    expect(player.toggle).not.toHaveBeenCalled();

    unmount();
    input.remove();
  });
});
