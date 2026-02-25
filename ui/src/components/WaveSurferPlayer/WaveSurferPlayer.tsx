import { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import { readFile } from "@tauri-apps/plugin-fs";
import type { Sample } from "../../types/sample";

interface WaveSurferPlayerProps {
  sample: Sample;
  filePath: string;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onSeek?: (time: number) => void;
  onPlayStateChange?: (playing: boolean) => void;
  height?: number;
}

export function WaveSurferPlayer({
  sample,
  filePath,
  isPlaying,
  currentTime,
  duration,
  onSeek,
  onPlayStateChange,
  height = 100,
}: WaveSurferPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  const getWaveColors = () => {
    if (sample.sample_type === "loop") {
      return { wave: "#22d3ee", progress: "#67e8f9" };
    }
    return { wave: "#c084fc", progress: "#f0abfc" };
  };

  const { wave: waveColor, progress: progressColor } = getWaveColors();

  // Cleanup blob URL
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, []);

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

  // Load audio file when path changes
  useEffect(() => {
    if (!wavesurferRef.current || !filePath) return;

    const loadAudio = async () => {
      setIsReady(false);
      setIsLoading(true);
      setError(null);

      try {
        // Clean up previous blob URL
        if (blobUrlRef.current) {
          URL.revokeObjectURL(blobUrlRef.current);
          blobUrlRef.current = null;
        }

        // Read file as binary using Tauri fs plugin
        const fileData = await readFile(filePath);
        
        // Create blob URL
        const blob = new Blob([fileData], { type: "audio/wav" });
        const blobUrl = URL.createObjectURL(blob);
        blobUrlRef.current = blobUrl;

        // Load into WaveSurfer
        await wavesurferRef.current!.load(blobUrl);
      } catch (err) {
        console.error("Failed to load audio:", err);
        setError(String(err));
        setIsLoading(false);
      }
    };

    loadAudio();
  }, [filePath]);

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
