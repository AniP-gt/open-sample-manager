import { act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  flushAudioLoad,
  renderWaveSurferPlayer,
  waveSurferPlayerElement,
  waveSurfer,
} from "./waveSurferPlayerTestHarness";

describe("WaveSurferPlayer playback synchronization", () => {
  it("syncs play/pause state when ready", async () => {
    const view = renderWaveSurferPlayer();

    await act(flushAudioLoad);
    act(() => waveSurfer().fire("ready"));

    view.rerender(waveSurferPlayerElement({ isPlaying: true }));
    expect(waveSurfer().play).toHaveBeenCalled();

    view.rerender(waveSurferPlayerElement({ isPlaying: false }));
    expect(waveSurfer().pause).toHaveBeenCalled();
  });

  it("keeps WaveSurfer muted when playback is disabled", async () => {
    const view = renderWaveSurferPlayer({ playbackEnabled: false });

    await act(flushAudioLoad);
    act(() => waveSurfer().fire("ready"));

    view.rerender(waveSurferPlayerElement({ isPlaying: true, playbackEnabled: false }));

    expect(waveSurfer().play).not.toHaveBeenCalled();
    expect(waveSurfer().pause).toHaveBeenCalled();
  });

  it("syncs seek position if time difference is greater than 0.5 seconds", async () => {
    const view = renderWaveSurferPlayer();

    await act(flushAudioLoad);
    act(() => waveSurfer().fire("ready"));
    waveSurfer().getCurrentTime = vi.fn().mockReturnValue(0);

    view.rerender(waveSurferPlayerElement({ currentTime: 0.5 }));
    expect(waveSurfer().seekTo).not.toHaveBeenCalled();

    view.rerender(waveSurferPlayerElement({ currentTime: 1 }));
    expect(waveSurfer().seekTo).toHaveBeenCalledWith(0.1);
  });
});
