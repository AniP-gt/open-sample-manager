import { render } from "@testing-library/react";
import type { ComponentProps } from "react";
import { beforeEach, vi } from "vitest";
import { WaveSurferPlayer } from "../WaveSurferPlayer";
import type { Sample } from "../../../types/sample";

export const mockConvertFileSrc = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (path: string) => mockConvertFileSrc(path),
}));

type WaveSurferHandler = (...args: readonly unknown[]) => void;

class FakeWaveSurfer {
  readonly handlers: Record<string, WaveSurferHandler[]> = {};
  readonly load = vi.fn().mockResolvedValue(undefined);
  readonly destroy = vi.fn();
  readonly play = vi.fn();
  readonly pause = vi.fn();
  readonly seekTo = vi.fn();
  getCurrentTime = vi.fn().mockReturnValue(0);

  on(event: string, callback: WaveSurferHandler) {
    const handlers = this.handlers[event] ?? [];
    handlers.push(callback);
    this.handlers[event] = handlers;
  }

  fire(event: string, ...args: readonly unknown[]) {
    this.handlers[event]?.forEach((handler) => handler(...args));
  }
}

let currentFakeWs: FakeWaveSurfer | null = null;

export const mockCreate = vi.fn(() => {
  currentFakeWs = new FakeWaveSurfer();
  return currentFakeWs;
});

vi.mock("wavesurfer.js", () => ({
  default: { create: () => mockCreate() },
}));

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

type WaveSurferPlayerTestProps = ComponentProps<typeof WaveSurferPlayer>;

export function renderWaveSurferPlayer(overrides: Partial<WaveSurferPlayerTestProps> = {}) {
  return render(waveSurferPlayerElement(overrides));
}

export function waveSurferPlayerElement(overrides: Partial<WaveSurferPlayerTestProps> = {}) {
  return (
    <WaveSurferPlayer
      sample={dummySample}
      filePath="/test/test.wav"
      isPlaying={false}
      currentTime={0}
      duration={10}
      {...overrides}
    />
  );
}

export function waveSurfer() {
  if (currentFakeWs === null) {
    throw new Error("WaveSurfer instance was not created");
  }
  return currentFakeWs;
}

export async function flushAudioLoad() {
  await Promise.resolve();
}

beforeEach(() => {
  vi.clearAllMocks();
  mockConvertFileSrc.mockImplementation((path: string) => `asset://${path}`);
  currentFakeWs = null;
});
