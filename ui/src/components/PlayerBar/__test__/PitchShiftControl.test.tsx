import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PitchShiftControl } from "../PitchShiftControl";

describe("PitchShiftControl", () => {
  let fakeWavesurfer: any;
  let fakeAudioContext: any;
  let fakeGainNode: any;
  let fakeWorkletNode: any;

  beforeEach(() => {
    fakeGainNode = {
      connect: vi.fn(),
      disconnect: vi.fn(),
    };

    fakeWorkletNode = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      port: {
        postMessage: vi.fn(),
      },
    };

    fakeAudioContext = {
      state: "running",
      resume: vi.fn().mockResolvedValue(undefined),
      destination: {},
      audioWorklet: {
        addModule: vi.fn().mockResolvedValue(undefined),
      },
    };

    vi.stubGlobal("AudioWorkletNode", vi.fn().mockImplementation(() => fakeWorkletNode));

    fakeWavesurfer = {
      getMediaElement: () => ({
        audioContext: fakeAudioContext,
        gainNode: fakeGainNode,
      }),
    };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("renders with disabled slider when no wavesurfer provided", () => {
    render(
      <PitchShiftControl
        audioElement={{} as HTMLAudioElement}
        isPlaying={false}
      />
    );
    const slider = screen.getByRole("slider", { name: "Pitch shift in semitones" });
    expect(slider).toBeDisabled();
    expect(screen.getByText("load a sample")).toBeInTheDocument();
  });

  it("disables slider when isPlaying is true", () => {
    render(
      <PitchShiftControl
        audioElement={{} as HTMLAudioElement}
        wavesurfer={fakeWavesurfer}
        isPlaying={true}
      />
    );
    const slider = screen.getByRole("slider", { name: "Pitch shift in semitones" });
    expect(slider).toBeDisabled();
  });

  it("changes pitch value and updates label", async () => {
    render(
      <PitchShiftControl
        audioElement={{} as HTMLAudioElement}
        wavesurfer={fakeWavesurfer}
        isPlaying={false}
      />
    );

    const slider = screen.getByRole("slider", { name: "Pitch shift in semitones" });
    expect(screen.getByText("0st")).toBeInTheDocument();

    fireEvent.change(slider, { target: { value: "3" } });
    expect(screen.getByText("+3st")).toBeInTheDocument();

    fireEvent.change(slider, { target: { value: "-2" } });
    expect(screen.getByText("-2st")).toBeInTheDocument();
  });

  it("resets pitch to 0 when reset button is clicked", () => {
    render(
      <PitchShiftControl
        audioElement={{} as HTMLAudioElement}
        wavesurfer={fakeWavesurfer}
        isPlaying={false}
      />
    );

    const slider = screen.getByRole("slider", { name: "Pitch shift in semitones" });
    fireEvent.change(slider, { target: { value: "5" } });
    expect(screen.getByText("+5st")).toBeInTheDocument();

    const resetBtn = screen.getByRole("button", { name: "0" });
    fireEvent.click(resetBtn);
    expect(screen.getByText("0st")).toBeInTheDocument();
    expect(slider).toHaveValue("0");
  });
});
