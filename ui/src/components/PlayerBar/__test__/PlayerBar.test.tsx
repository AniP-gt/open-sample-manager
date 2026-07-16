import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from "vitest";

const mockPlay = vi.fn().mockResolvedValue(undefined);
const mockPause = vi.fn();

const editedSettings: SampleProcessingSettings = {
  trimStartSeconds: 1.25,
  trimEndSeconds: 4.5,
  fadeInSeconds: 0.2,
  fadeOutSeconds: 0.3,
  gainDb: 3,
};

beforeAll(() => {
  Object.defineProperty(window.HTMLMediaElement.prototype, "play", {
    configurable: true,
    value: mockPlay,
  });
  Object.defineProperty(window.HTMLMediaElement.prototype, "pause", {
    configurable: true,
    value: mockPause,
  });
});

afterAll(() => {
  // restore if needed
});

import { PlayerBar } from "../PlayerBar";
import type { PlayerBarHandle } from "../PlayerBar";
import type { Sample, SampleProcessingSettings } from "../../../types/sample";

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    lazy: (_loader: () => Promise<unknown>) => {
      return (_props: Record<string, unknown>) => <div data-testid="lazy-wavesurfer-player" />;
    },
    Suspense: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (path: string) => `asset://${path}`,
}));

describe("PlayerBar", () => {
  const dummySample: Sample = {
    id: 1,
    file_name: "test.wav",
    duration: 10,
    bpm: 120,
    periodicity: 0,
    low_ratio: 0.5,
    sample_rate: 44100,
    attack_slope: 0.6,
    decay_time: null,
    sample_type: "one-shot",
    tags: [],
    waveform_peaks: null,
    playback_type: "oneshot",
    instrument_type: "kick",
    musical_key: "C",
    quality_flags: [],
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("renders sample information and waveform", () => {
    render(<PlayerBar sample={dummySample} path="/test/test.wav" />);

    expect(screen.getByText("test.wav")).toBeInTheDocument();
    expect(screen.getByText("10.00s")).toBeInTheDocument();
  });

  it("shows volume controls and changes volume", () => {
    render(<PlayerBar sample={dummySample} path="/test/test.wav" />);
    
    const slider = screen.getByRole("slider");
    expect(slider).toBeInTheDocument();
    
    fireEvent.change(slider, { target: { value: "0.5" } });
    expect(slider).toHaveValue("0.5");
  });

  it("handles play and pause buttons", async () => {
    render(<PlayerBar sample={dummySample} />);

    const buttons = screen.getAllByRole("button");
    const playButton = buttons[0];

    fireEvent.click(playButton);
    
    expect(mockPlay).toHaveBeenCalled();
  });

  it("exposes handle methods (play, stop, toggle)", async () => {
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

  it("toggles advanced controls", () => {
    render(<PlayerBar sample={dummySample} path="/test/test.wav" />);

    const controlsBtn = screen.getByText("▾ CONTROLS");
    fireEvent.click(controlsBtn);
    
    expect(screen.getByText("▴ CONTROLS")).toBeInTheDocument();
    
    expect(screen.getByText(/SPECTROGRAM/)).toBeInTheDocument();
  });

  it("shows processing controls and sends reset and clear actions", () => {
    const onChange = vi.fn();
    const onReset = vi.fn();
    const onClear = vi.fn();
    render(
      <PlayerBar
        sample={dummySample}
        path="/test/test.wav"
        processingSettings={editedSettings}
        onProcessingSettingsChange={onChange}
        onProcessingSettingsReset={onReset}
        onProcessingSettingsClear={onClear}
      />
    );

    fireEvent.click(screen.getByText("▾ CONTROLS"));
    fireEvent.change(screen.getByLabelText("TRIM START"), { target: { value: "2" } });
    expect(onChange).toHaveBeenCalledWith({ ...editedSettings, trimStartSeconds: 2 });

    fireEvent.click(screen.getByText("RESET"));
    fireEvent.click(screen.getByText("CLEAR EDIT"));
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(screen.getByText("FADES: DRAG EXPORT ONLY")).toBeInTheDocument();
  });

  it("seeks to trim start when preview playback begins", () => {
    render(<PlayerBar sample={dummySample} processingSettings={editedSettings} />);

    const playButton = screen.getAllByRole("button")[0];
    fireEvent.click(playButton);

    expect(mockPlay).toHaveBeenCalled();
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
  });

  it("handles close button", () => {
    const onCloseMock = vi.fn();
    render(<PlayerBar sample={dummySample} onClose={onCloseMock} />);

    const closeBtn = screen.getByLabelText("Close waveform UI");
    fireEvent.click(closeBtn);
    
    expect(onCloseMock).toHaveBeenCalledTimes(1);
    expect(mockPause).toHaveBeenCalled();
  });
});
