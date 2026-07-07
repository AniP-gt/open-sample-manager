import { render, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { WaveformDisplay } from "../WaveformDisplay";
import type { Sample } from "../../../types/sample";

describe("WaveformDisplay", () => {
  const dummySample: Sample = {
    id: 1,
    file_name: "test.wav",
    duration: 1.5,
    bpm: 120,
    periodicity: 0,
    low_ratio: 0.5,
    sample_rate: 44100,
    attack_slope: 0.6,
    decay_time: null,
    sample_type: "one-shot",
    tags: [],
    waveform_peaks: [0.1, 0.5, 0.9, 0.3],
    playback_type: "oneshot",
    instrument_type: "kick",
    musical_key: "C",
    quality_flags: [],
  };

  it("renders an SVG with waveform data", () => {
    const { container } = render(
      <WaveformDisplay sample={dummySample} isPlaying={false} />
    );
    expect(container.querySelector("svg")).toBeInTheDocument();
    expect(container.querySelector("path")).toBeInTheDocument();
  });

  it("uses random generation when waveform_peaks is empty", () => {
    const sampleWithoutPeaks = { ...dummySample, waveform_peaks: null };
    const { container } = render(
      <WaveformDisplay sample={sampleWithoutPeaks} isPlaying={false} />
    );
    expect(container.querySelector("path")).toBeInTheDocument();
  });

  it("seeks on click when onSeek is provided", () => {
    const onSeekMock = vi.fn();
    const { container } = render(
      <WaveformDisplay
        sample={dummySample}
        isPlaying={true}
        duration={2.0}
        onSeek={onSeekMock}
      />
    );

    const div = container.firstChild as HTMLDivElement;
    
    vi.spyOn(div, 'getBoundingClientRect').mockReturnValue({
      width: 100,
      left: 10,
      height: 48,
      top: 0,
      bottom: 48,
      right: 110,
      x: 10,
      y: 0,
      toJSON: () => {}
    });

    fireEvent.click(div, { clientX: 60 });
    expect(onSeekMock).toHaveBeenCalledWith(1.0);
  });

  it("does not call onSeek if disabled or not provided", () => {
    const onSeekMock = vi.fn();
    const { container } = render(
      <WaveformDisplay
        sample={dummySample}
        isPlaying={true}
        duration={0}
        onSeek={onSeekMock}
      />
    );
    
    const div = container.firstChild as HTMLDivElement;
    fireEvent.click(div);
    expect(onSeekMock).not.toHaveBeenCalled();
  });
});
