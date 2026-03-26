import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { readFile } from "@tauri-apps/plugin-fs";
import type { Sample } from "../../types/sample";
import { WaveSurferPlayer } from "../WaveSurferPlayer/WaveSurferPlayer";
import { TypeBadge } from "../TypeBadge/TypeBadge";

interface PlayerBarProps {
  sample: Sample;
  path?: string;
  onClose?: () => void;
  autoPlay?: boolean;
}

export interface PlayerBarHandle {
  stop: () => void;
  play: () => void;
  isPlaying: boolean;
}

export const PlayerBar = forwardRef<PlayerBarHandle, PlayerBarProps>(function PlayerBar({ sample, path, onClose, autoPlay }: PlayerBarProps, ref) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const handleClose = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setLoadError(null);
    if (onClose) onClose();
  };

  // Reset state when path changes
  useEffect(() => {
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setLoading(false);
    setLoadError(null);
  }, [path]);

  // Create audio element when path changes
  useEffect(() => {
    if (!path) {
      audioRef.current = null;
      return;
    }

    let isMounted = true;
    let currentAudioUrl: string | null = null;

    const loadAudio = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const fileData = await readFile(path);
        if (!isMounted) return;

        const blob = new Blob([fileData], { type: "audio/wav" });
        const audioUrl = URL.createObjectURL(blob);
        currentAudioUrl = audioUrl;
        if (!isMounted) {
          URL.revokeObjectURL(audioUrl);
          return;
        }

        const audio = new Audio(audioUrl);
        audio.onended = () => setPlaying(false);
        audio.onpause = () => setPlaying(false);
        audio.onplay = () => setPlaying(true);
        audio.ontimeupdate = () => setCurrentTime(audio.currentTime);
        audio.onloadedmetadata = () => setDuration(audio.duration);
        audioRef.current = audio;
        setLoading(false);
        if (autoPlay) {
          audio.play().catch(() => {});
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        const isFileNotFound = 
          errorMessage.includes("not found") ||
          errorMessage.includes("No such file") ||
          errorMessage.includes("ENOENT") ||
          errorMessage.includes("path does not exist");
        
        if (isFileNotFound) {
          setLoadError("ファイルパスが見つかりません");
        } else {
          setLoadError(errorMessage);
        }
        setLoading(false);
      }
    };

    loadAudio();

    return () => {
      isMounted = false;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }
      if (currentAudioUrl) {
        URL.revokeObjectURL(currentAudioUrl);
      }
    };
  }, [path]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
  };

  // Expose stop method to parent
  useImperativeHandle(
    ref,
    () => ({
      stop: () => {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          setPlaying(false);
          setCurrentTime(0);
        }
      },
      play: () => {
        if (audioRef.current && !playing) {
          audioRef.current.play().catch(() => {});
        }
      },
      isPlaying: playing,
    }),
    [playing],
  );

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: "160px",
        background: "linear-gradient(to top, #0a0c12 0%, #0d1019 60%, #0d101999 100%)",
        borderTop: "1px solid #1a1f2e",
        padding: "12px 24px 16px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        backdropFilter: "blur(12px)",
        zIndex: 100,
      }}
    >
      {/* Sample Info & Controls */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "16px",
        }}
      >
        {/* Play Button */}
        <button
          onClick={() => {
            if (loadError) {
              setLoadError(null);
              return;
            }
            if (!audioRef.current || loading) {
              return;
            }
            if (playing) {
              audioRef.current.pause();
            } else {
              audioRef.current.play().catch((err) => {
                setLoadError(err.message);
              });
            }
          }}
          style={{
            background: playing ? "#f97316" : loading ? "#374151" : "#1f2937",
            border: "none",
            borderRadius: "50%",
            width: "44px",
            height: "44px",
            cursor: loading ? "not-allowed" : "pointer",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: loading ? 0.6 : 1,
            flexShrink: 0,
            transition: "all 0.15s ease",
          }}
        >
          {loading ? (
            <div
              style={{
                width: "16px",
                height: "16px",
                border: "2px solid #fff",
                borderTopColor: "transparent",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
              }}
            />
          ) : playing ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" />
              <rect x="14" y="4" width="4" height="16" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          )}
        </button>

        {/* Sample Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: "14px",
              color: "#f1f5f9",
              fontWeight: 500,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {sample.file_name}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "2px" }}>
            <TypeBadge type={sample.sample_type} />
            {sample.bpm && (
              <span style={{ fontSize: "12px", color: "#22d3ee", letterSpacing: "0.1em" }}>
                {Math.floor(sample.bpm)} BPM
              </span>
            )}
            <span style={{ fontSize: "12px", color: "#6b7280" }}>
              {sample.duration.toFixed(2)}s
            </span>
          </div>
        </div>

        {/* Time Display */}
        <div
          style={{
            fontFamily: "'Courier New', monospace",
            fontSize: "13px",
            color: "#9ca3af",
            display: "flex",
            gap: "4px",
          }}
        >
          <span style={{ color: playing ? "#f97316" : "#9ca3af" }}>
            {formatTime(currentTime)}
          </span>
          <span style={{ color: "#4b5563" }}>/</span>
          <span>{formatTime(duration || sample.duration)}</span>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
        <div style={{ position: "absolute", top: 8, right: 8, zIndex: 200 }}>
          <button
            aria-label="Close waveform UI"
            title="Close waveform UI"
            onClick={handleClose}
            style={{
              background: "transparent",
              border: "none",
              color: "#9ca3af",
              width: 28,
              height: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 6L18 18M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <WaveSurferPlayer
          sample={sample}
          filePath={path || ""}
          isPlaying={playing}
          currentTime={currentTime}
          duration={duration || sample.duration}
          height={100}
          onSeek={(time) => {
            if (audioRef.current) {
              audioRef.current.currentTime = time;
              setCurrentTime(time);
            }
          }}
        />
      </div>

      {/* Error Message */}
      {loadError && (
        <div
          style={{
            position: "absolute",
            top: "-32px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "#ef4444",
            color: "#fff",
            padding: "6px 12px",
            borderRadius: "4px",
            fontSize: "12px",
            whiteSpace: "nowrap",
          }}
        >
          {loadError}
        </div>
      )}
    </div>
  );
});
