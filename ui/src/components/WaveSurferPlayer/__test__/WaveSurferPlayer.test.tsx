import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { WaveSurferPlayer } from "../WaveSurferPlayer";
import type { Sample } from "../../../types/sample";

const mockConvertFileSrc = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (path: string) => mockConvertFileSrc(path),
}));

class FakeWaveSurfer {
  handlers: Record<string, Function[]> = {};
  
  on(event: string, callback: Function) {
    if (!this.handlers[event]) this.handlers[event] = [];
    this.handlers[event].push(callback);
  }
  
  fire(event: string, ...args: any[]) {
    if (this.handlers[event]) {
      this.handlers[event].forEach(cb => cb(...args));
    }
  }

  load = vi.fn().mockResolvedValue(undefined);
  destroy = vi.fn();
  play = vi.fn();
  pause = vi.fn();
  seekTo = vi.fn();
  getCurrentTime = vi.fn().mockReturnValue(0);
}

let currentFakeWs: FakeWaveSurfer | null = null;
const mockCreate = vi.fn().mockImplementation(() => {
  currentFakeWs = new FakeWaveSurfer();
  return currentFakeWs;
});

vi.mock("wavesurfer.js", () => {
  return {
    default: {
      create: (...args: any[]) => mockCreate(...args),
    },
  };
});

describe("WaveSurferPlayer", () => {
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
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockConvertFileSrc.mockImplementation(path => `asset://${path}`);
    currentFakeWs = null;
  });

  it("renders container and loads file", async () => {
    render(
      <WaveSurferPlayer
        sample={dummySample}
        filePath="/test/test.wav"
        isPlaying={false}
        currentTime={0}
        duration={10}
      />
    );
    
    expect(mockCreate).toHaveBeenCalled();
    expect(screen.getByText("Loading...")).toBeInTheDocument();
    
    expect(mockConvertFileSrc).toHaveBeenCalledWith("/test/test.wav");
    await act(async () => {
      await Promise.resolve();
    });
    
    expect(currentFakeWs?.load).toHaveBeenCalledWith("asset:///test/test.wav");
  });

  it("uses provided blobUrl and bypasses convertFileSrc", async () => {
    render(
      <WaveSurferPlayer
        sample={dummySample}
        filePath="/test/test.wav"
        blobUrl="blob:http://localhost/abc"
        isPlaying={false}
        currentTime={0}
        duration={10}
      />
    );
    
    await act(async () => {
      await Promise.resolve();
    });
    
    expect(mockConvertFileSrc).not.toHaveBeenCalled();
    expect(currentFakeWs?.load).toHaveBeenCalledWith("blob:http://localhost/abc");
  });

  it("handles ready event and calls onWaveSurferReady", async () => {
    const onReadyMock = vi.fn();
    render(
      <WaveSurferPlayer
        sample={dummySample}
        filePath="/test/test.wav"
        isPlaying={false}
        currentTime={0}
        duration={10}
        onWaveSurferReady={onReadyMock}
      />
    );
    
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      currentFakeWs?.fire("ready");
    });

    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
    expect(onReadyMock).toHaveBeenCalledWith(currentFakeWs);
  });

  it("handles error event", async () => {
    render(
      <WaveSurferPlayer
        sample={dummySample}
        filePath="/test/test.wav"
        isPlaying={false}
        currentTime={0}
        duration={10}
      />
    );
    
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      currentFakeWs?.fire("error", new Error("Decode failed"));
    });

    expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
    expect(screen.getByText("Error: Decode failed")).toBeInTheDocument();
  });

  it("calls onSeek on audioprocess and seeking", async () => {
    const onSeekMock = vi.fn();
    render(
      <WaveSurferPlayer
        sample={dummySample}
        filePath="/test/test.wav"
        isPlaying={false}
        currentTime={0}
        duration={10}
        onSeek={onSeekMock}
      />
    );
    
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      currentFakeWs?.fire("audioprocess", 1.5);
      currentFakeWs?.fire("seeking", 2.0);
    });

    expect(onSeekMock).toHaveBeenCalledWith(1.5);
    expect(onSeekMock).toHaveBeenCalledWith(2.0);
  });

  it("syncs play/pause state when ready", async () => {
    const { rerender } = render(
      <WaveSurferPlayer
        sample={dummySample}
        filePath="/test/test.wav"
        isPlaying={false}
        currentTime={0}
        duration={10}
      />
    );
    
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      currentFakeWs?.fire("ready");
    });
    
    rerender(
      <WaveSurferPlayer
        sample={dummySample}
        filePath="/test/test.wav"
        isPlaying={true}
        currentTime={0}
        duration={10}
      />
    );
    
    expect(currentFakeWs?.play).toHaveBeenCalled();

    rerender(
      <WaveSurferPlayer
        sample={dummySample}
        filePath="/test/test.wav"
        isPlaying={false}
        currentTime={0}
        duration={10}
      />
    );
    
    expect(currentFakeWs?.pause).toHaveBeenCalled();
  });

  it("keeps WaveSurfer muted when playback is disabled", async () => {
    const { rerender } = render(
      <WaveSurferPlayer
        sample={dummySample}
        filePath="/test/test.wav"
        isPlaying={false}
        currentTime={0}
        duration={10}
        playbackEnabled={false}
      />
    );

    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      currentFakeWs?.fire("ready");
    });

    rerender(
      <WaveSurferPlayer
        sample={dummySample}
        filePath="/test/test.wav"
        isPlaying={true}
        currentTime={0}
        duration={10}
        playbackEnabled={false}
      />
    );

    expect(currentFakeWs?.play).not.toHaveBeenCalled();
    expect(currentFakeWs?.pause).toHaveBeenCalled();
  });

  it("syncs seek position if time difference is > 0.5s", async () => {
    const { rerender } = render(
      <WaveSurferPlayer
        sample={dummySample}
        filePath="/test/test.wav"
        isPlaying={false}
        currentTime={0}
        duration={10}
      />
    );
    
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      currentFakeWs?.fire("ready");
    });
    
    currentFakeWs!.getCurrentTime = vi.fn().mockReturnValue(0);

    rerender(
      <WaveSurferPlayer
        sample={dummySample}
        filePath="/test/test.wav"
        isPlaying={false}
        currentTime={0.5}
        duration={10}
      />
    );
    expect(currentFakeWs?.seekTo).not.toHaveBeenCalled();

    rerender(
      <WaveSurferPlayer
        sample={dummySample}
        filePath="/test/test.wav"
        isPlaying={false}
        currentTime={1.0}
        duration={10}
      />
    );
    expect(currentFakeWs?.seekTo).toHaveBeenCalledWith(1.0 / 10);
  });

  it("fires onPlayStateChange on internal play/pause events", async () => {
    const onPlayStateChangeMock = vi.fn();
    render(
      <WaveSurferPlayer
        sample={dummySample}
        filePath="/test/test.wav"
        isPlaying={false}
        currentTime={0}
        duration={10}
        onPlayStateChange={onPlayStateChangeMock}
      />
    );
    
    await act(async () => {
      await Promise.resolve();
    });

    act(() => {
      currentFakeWs?.fire("play");
      currentFakeWs?.fire("pause");
    });
    
    expect(onPlayStateChangeMock).toHaveBeenCalledWith(true);
    expect(onPlayStateChangeMock).toHaveBeenCalledWith(false);
  });
});
