import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { vi } from "vitest";

// Mock the Tauri invoke function used by DetailPanel
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
import { DetailPanel } from "./DetailPanel";
import type { Sample } from "../../types/sample";

const sample: Sample = {
  id: 1,
  file_name: "kick.wav",
  duration: 0.5,
  bpm: 120,
  periodicity: 0.7,
  low_ratio: 0.7,
  sample_rate: 44100,
  attack_slope: 2.0,
  decay_time: 100,
  sample_type: "one-shot",
  tags: [],
  waveform_peaks: null,
  playback_type: "oneshot",
  instrument_type: "kick",
};

test("Find similar samples flow opens modal and selects item", async () => {
  const mockResults = [
    {
      similarity: 0.82345,
      row: {
        id: 2,
        path: "/tmp/samples/snare.wav",
        file_name: "snare.wav",
        duration: 0.3,
        bpm: 122,
        periodicity: 0.1,
        low_ratio: 0.2,
        attack_slope: 0.5,
        decay_time: null,
        sample_type: "one-shot",
        waveform_peaks: null,
        playback_type: "oneshot",
        instrument_type: "snare",
      },
    },
  ];

  // @ts-expect-error mocked
  invoke.mockResolvedValue(mockResults);

  const onSelect = vi.fn();

  render(<DetailPanel sample={sample} path={"/tmp/samples/kick.wav"} onSelect={onSelect} />);

  // Click the Find similar samples button
  const btn = screen.getByRole("button", { name: /find similar samples/i });
  fireEvent.click(btn);

  // Wait for the modal to appear with percentage text
  await waitFor(() => {
    expect(screen.getByText(/82.3%/)).toBeInTheDocument();
  });

  // Click the result entry
  const entry = screen.getByText("snare.wav");
  fireEvent.click(entry);

  // onSelect should be called with the mapped sample and path
  await waitFor(() => {
    expect(onSelect).toHaveBeenCalled();
    const callArg = onSelect.mock.calls[0][1];
    expect(callArg).toBe("/tmp/samples/snare.wav");
  });
});
