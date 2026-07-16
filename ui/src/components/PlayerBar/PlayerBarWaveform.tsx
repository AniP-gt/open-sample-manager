import { lazy, Suspense } from "react";
import type WaveSurfer from "wavesurfer.js";
import { convertFileSrc } from "@tauri-apps/api/core";
import type { Sample } from "../../types/sample";
import { WaveformDisplay } from "../WaveformDisplay/WaveformDisplay";

const LazyWaveSurferPlayer = lazy(() => import("../WaveSurferPlayer/WaveSurferPlayer").then((module) => ({ default: module.WaveSurferPlayer })));

interface PlayerBarWaveformProps {
  readonly sample: Sample;
  readonly stablePath: string | undefined;
  readonly autoPlay: boolean | undefined;
  readonly playing: boolean;
  readonly currentTime: number;
  readonly duration: number;
  readonly onClose: () => void;
  readonly onSeek: (time: number) => void;
  readonly onWaveSurferReady: (wavesurfer: WaveSurfer) => void;
}

export function PlayerBarWaveform({ sample, stablePath, autoPlay, playing, currentTime, duration, onClose, onSeek, onWaveSurferReady }: PlayerBarWaveformProps) {
  return (
    <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
      <div style={{ position: "absolute", top: 8, right: 8, zIndex: 200 }}>
        <button aria-label="Close waveform UI" title="Close waveform UI" onClick={onClose} style={{ background: "transparent", border: "none", color: "#9ca3af", width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 6L18 18M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {!autoPlay && stablePath ? (
        <Suspense fallback={<WaveformDisplay sample={sample} isPlaying={playing} currentTime={currentTime} duration={duration || sample.duration} height={100} />}>
          <LazyWaveSurferPlayer
            sample={sample}
            filePath={stablePath}
            blobUrl={convertFileSrc(stablePath)}
            isPlaying={playing}
            currentTime={currentTime}
            duration={duration || sample.duration}
            height={100}
            playbackEnabled={true}
            onSeek={onSeek}
            onWaveSurferReady={onWaveSurferReady}
          />
        </Suspense>
      ) : (
        <WaveformDisplay sample={sample} isPlaying={playing} currentTime={currentTime} duration={duration || sample.duration} height={100} onSeek={onSeek} />
      )}
    </div>
  );
}
