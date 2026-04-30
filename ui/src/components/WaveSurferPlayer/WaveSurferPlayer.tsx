import { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import { convertFileSrc } from "@tauri-apps/api/core";
import type { Sample } from "../../types/sample";

interface WaveSurferPlayerProps {
  sample: Sample;
  filePath: string;
  /** Pre-loaded asset URL — if provided, avoids a second convertFileSrc call. */
  blobUrl?: string | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onSeek?: (time: number) => void;
  onPlayStateChange?: (playing: boolean) => void;
  /** Called once when the underlying WaveSurfer instance has finished
   *  loading and is ready for plugin registration / external control. */
  onWaveSurferReady?: (ws: WaveSurfer) => void;
  height?: number;
}

export function WaveSurferPlayer({
  sample,
  filePath,
  blobUrl: externalBlobUrl,
  isPlaying,
  currentTime,
  duration,
  onSeek,
  onPlayStateChange,
  onWaveSurferReady,
  height = 100,
}: WaveSurferPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The init effect's deps don't include `onWaveSurferReady`; without a ref
  // the handler captured at mount would be stale once the parent rerenders
  // with a new closure (e.g. one that captures a fresh wavesurferInstance
  // setter). Storing the latest callback in a ref keeps the init effect
  // stable while still firing the freshest `ready` notification.
  const onWaveSurferReadyRef = useRef(onWaveSurferReady);
  onWaveSurferReadyRef.current = onWaveSurferReady;

  const getWaveColors = () => {
    if (sample.sample_type === "loop") {
      return { wave: "#22d3ee", progress: "#67e8f9" };
    }
    return { wave: "#c084fc", progress: "#f0abfc" };
  };

  const { wave: waveColor, progress: progressColor } = getWaveColors();

  // Initialize WaveSurfer
  useEffect(() => {
    if (!containerRef.current) return;

    // Destroy existing instance if any
    if (wavesurferRef.current) {
      wavesurferRef.current.destroy();
    }

    const wavesurfer = WaveSurfer.create({
      container: containerRef.current,
      waveColor: waveColor,
      progressColor: progressColor,
      height: height,
      backend: "WebAudio",
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      cursorWidth: 1,
      cursorColor: isPlaying ? progressColor : waveColor,
      normalize: true,
      fillParent: true,
    });

    wavesurfer.on("ready", () => {
      setIsReady(true);
      setIsLoading(false);
      setError(null);
      onWaveSurferReadyRef.current?.(wavesurfer);
    });

    wavesurfer.on("error", (err) => {
      console.error("WaveSurfer error:", err);
      setError(String(err));
      setIsLoading(false);
    });

    wavesurfer.on("audioprocess", (time) => {
      if (onSeek) {
        onSeek(time);
      }
    });

    wavesurfer.on("seeking", (time) => {
      if (onSeek) {
        onSeek(time);
      }
    });

    wavesurfer.on("play", () => {
      if (onPlayStateChange) {
        onPlayStateChange(true);
      }
    });

    wavesurfer.on("pause", () => {
      if (onPlayStateChange) {
        onPlayStateChange(false);
      }
    });

    wavesurferRef.current = wavesurfer;

    return () => {
      wavesurfer.destroy();
      wavesurferRef.current = null;
    };
  }, [height, waveColor, progressColor]);

  // Load audio file when path changes — use asset protocol URL (no JS memory allocation)
  useEffect(() => {
    if (!wavesurferRef.current || !filePath) return;

    let cancelled = false;

    const loadAudio = async () => {
      setIsReady(false);
      setIsLoading(true);
      setError(null);

      try {
        const url = externalBlobUrl || convertFileSrc(filePath);

        if (cancelled) return;

        if (wavesurferRef.current) {
          await wavesurferRef.current.load(url);
        }
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to load audio:", err);
        setError(String(err));
        setIsLoading(false);
      }
    };

    loadAudio();

    return () => {
      cancelled = true;
    };
  }, [filePath, externalBlobUrl]);

  // Sync play/pause state
  useEffect(() => {
    if (!wavesurferRef.current || !isReady) return;

    if (isPlaying) {
      wavesurferRef.current.play();
    } else {
      wavesurferRef.current.pause();
    }
  }, [isPlaying, isReady]);

  // Sync seek position
  useEffect(() => {
    if (!wavesurferRef.current || !isReady || !duration) return;

    const newTime = currentTime;

    if (Math.abs(wavesurferRef.current.getCurrentTime() - newTime) > 0.5) {
      wavesurferRef.current.seekTo(newTime / duration);
    }
  }, [currentTime, duration, isReady]);

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: `${height}px`,
        minHeight: `${height}px`,
        position: "relative",
        cursor: onSeek ? "pointer" : "default",
      }}
    >
      {isLoading && !isReady && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            color: "#9ca3af",
            fontSize: "12px",
          }}
        >
          Loading...
        </div>
      )}
      {error && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            color: "#ef4444",
            fontSize: "11px",
            textAlign: "center",
            maxWidth: "80%",
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
