import { act, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  flushAudioLoad,
  renderWaveSurferPlayer,
  waveSurfer,
} from "./waveSurferPlayerTestHarness";

describe("WaveSurferPlayer WaveSurfer events", () => {
  it("handles ready event and calls onWaveSurferReady", async () => {
    const onReadyMock = vi.fn();
    renderWaveSurferPlayer({ onWaveSurferReady: onReadyMock });

    await act(flushAudioLoad);
    act(() => waveSurfer().fire("ready"));

    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
    expect(onReadyMock).toHaveBeenCalledWith(waveSurfer());
  });

  it("handles error event", async () => {
    renderWaveSurferPlayer();

    await act(flushAudioLoad);
    act(() => waveSurfer().fire("error", new Error("Decode failed")));

    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
    expect(screen.getByText("Error: Decode failed")).toBeInTheDocument();
  });

  it("calls onSeek on audioprocess and seeking", async () => {
    const onSeekMock = vi.fn();
    renderWaveSurferPlayer({ onSeek: onSeekMock });

    await act(flushAudioLoad);
    act(() => {
      waveSurfer().fire("audioprocess", 1.5);
      waveSurfer().fire("seeking", 2);
    });

    expect(onSeekMock).toHaveBeenCalledWith(1.5);
    expect(onSeekMock).toHaveBeenCalledWith(2);
  });

  it("fires onPlayStateChange on internal play/pause events", async () => {
    const onPlayStateChangeMock = vi.fn();
    renderWaveSurferPlayer({ onPlayStateChange: onPlayStateChangeMock });

    await act(flushAudioLoad);
    act(() => {
      waveSurfer().fire("play");
      waveSurfer().fire("pause");
    });

    expect(onPlayStateChangeMock).toHaveBeenCalledWith(true);
    expect(onPlayStateChangeMock).toHaveBeenCalledWith(false);
  });
});
